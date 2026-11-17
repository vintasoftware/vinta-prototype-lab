import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnnotationOverlay, type NumberedAnnotation } from '../components/annotation-overlay'
import { InspectOverlay } from '../components/inspect-overlay'
import { MeasureOverlay } from '../components/measure-overlay'
import { PrototypeFrame } from '../components/prototype-frame'
import {
  PrototypeRuntime,
  type RuntimeVersion,
  type ScreenNavigation,
  VersionProvider,
} from '../components/prototype-runtime'
import { ResizableFrame } from '../components/resizable-frame'
import { useAnchorRects } from '../hooks/use-anchor-rects'
import { useComponentTree } from '../hooks/use-component-tree'
import { useElementSize } from '../hooks/use-element-size'
import { useFlowLinks } from '../hooks/use-flow-links'
import { useInspectMode } from '../hooks/use-inspect-mode'
import { useInspectRects } from '../hooks/use-inspect-rects'
import { useKeyHeld } from '../hooks/use-key-held'
import { usePrototypeSession } from '../hooks/use-prototype-session'
import { useStorybookLinks } from '../hooks/use-storybook-links'
import { TOGGLE_KEYS, useViewToggles } from '../hooks/use-view-toggles'
import { useVisibleBox } from '../hooks/use-visible-box'
import { type AnnotationEdit, annotationId } from '../lib/annotation-edit'
import { annotationsForScreen } from '../lib/annotations'
import { canEditAnnotations, nameElement, saveAnnotationEdit, saveCanvas } from '../lib/annotations-api'
import { componentSelector, resolveComponentSelector } from '../lib/component-link'
import { ancestorPaths, nearestNodePath } from '../lib/component-tree'
import { DEFAULT_VARIANT, FRAME_HEIGHT, VIEWPORT_LABEL, VIEWPORT_WIDTH } from '../lib/constants'
import {
  type DeviceFrame,
  type DeviceSettings,
  fitScale,
  frameCaption,
  frameName,
  frameScale,
  readDeviceSettings,
  viewportOfWidth,
  writeDeviceSettings,
} from '../lib/device-frame'
import { distinctScreens, resolveScreen } from '../lib/discovery'
import { exportPng, pngFileName } from '../lib/export-png'
import { type FlowNodeKey, flowNodeKey, type ScreenLinks } from '../lib/flow-graph'
import { boxModel, measureBetween } from '../lib/measure'
import { type PresentMode, presentModeIn, writePresenting } from '../lib/present-param'
import { SOURCE_ATTRIBUTE, suggestAnchorId } from '../lib/source-ref'
import { findStorybookLink, type StorybookOptions } from '../lib/storybook-links'
import { linkToastText, listedIn, outOfVersion, statesForVersion } from '../lib/version'
import type { Annotation, CanvasFile, Prototype, ScreenViewport } from '../types'
import { cn } from '../ui'
import { CanvasView } from './canvas/canvas-view'
import { type CommentDraft, chosenName } from './comment-composer'
import { DevPanel } from './dev-panel'
import { EmptyLab } from './empty-lab'
import { PresentingStage } from './presenting-stage'
import { type PanelTab, SidePanel } from './side-panel'
import { SlidePanel } from './slide-panel'
import { VersionPlaceholder, ViewerToast } from './version-notices'
import { ViewerHeader } from './viewer-header'
import { ViewerSidebar } from './viewer-sidebar'

export interface PrototypeLabAppProps {
  prototypes: Prototype[]
  /** Where the component tree finds Storybook pages to link to; `false` shows no links. */
  storybook?: StorybookOptions | false
  /**
   * Shows the Mobile / Tablet / Desktop switcher; `false` draws every screen in its own viewport,
   * unless a size is chosen in the device toolbar, which shows either way.
   */
  viewportSwitcher?: boolean
  /** The guided tour player's address. The header links to it only when it is given. */
  player?: string
}

const AUTHOR_KEY = 'prototype-lab.author'

const NONE_MISSING: ReadonlySet<string> = new Set()

function rememberedAuthor(): string {
  try {
    return window.localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * The viewer: a prototype's screens on the left, the screen on stage in the middle with the
 * designers' comments drawn over it, and the prototype's documentation on the right. Either side
 * closes, so the screen can have the window to itself. The stage can give way to the canvas,
 * which shows every screen and where each control leads.
 */
export function PrototypeLabApp({
  prototypes: loaded,
  storybook: storybookOptions,
  viewportSwitcher = true,
  player,
}: PrototypeLabAppProps) {
  const [prototypes, setPrototypes] = useState(loaded)
  const session = usePrototypeSession(prototypes)
  const { prototype: fullPrototype, screen, state } = session

  // The version picked in the header. The rest of the viewer works on `prototype`, which holds only
  // the states and notes of that version; the session keeps the whole one, so a deep link to a
  // state outside the version still resolves and shows the placeholder.
  const versions = fullPrototype?.doc.versions
  const runtimeVersion = useMemo(
    (): RuntimeVersion | undefined =>
      versions === undefined
        ? undefined
        : { versions, ...(state.version === undefined ? {} : { selected: state.version }) },
    [versions, state.version]
  )
  const prototype = useMemo(() => {
    if (fullPrototype === undefined || versions === undefined || state.version === undefined) {
      return fullPrototype
    }
    return {
      ...fullPrototype,
      screens: statesForVersion(fullPrototype.screens, versions, state.version),
      annotations: fullPrototype.annotations.filter(note => listedIn(versions, state.version, note)),
    }
  }, [fullPrototype, versions, state.version])
  // Chips only in All: with a version picked, everything listed belongs to it.
  const chipVersions = state.version === undefined ? versions : undefined
  const screenMissing =
    screen === undefined || versions === undefined ? undefined : outOfVersion(versions, state.version, screen)
  const [toast, setToast] = useState<string | undefined>(undefined)
  const dismissToast = useCallback(() => setToast(undefined), [])

  /**
   * Whether a link may open a state. One outside the picked version does not open: the toast says
   * which version has it.
   */
  const canOpen = useCallback(
    (screenId: string, variant: string | undefined) => {
      if (fullPrototype === undefined || versions === undefined) {
        return true
      }
      const target = resolveScreen(fullPrototype, { screenId, variant: variant ?? DEFAULT_VARIANT })
      const missing = target === undefined ? undefined : outOfVersion(versions, state.version, target)
      if (missing === undefined) {
        return true
      }
      setToast(linkToastText(missing))
      return false
    },
    [fullPrototype, versions, state.version]
  )

  const [viewportOverride, setViewportOverride] = useState<ScreenViewport | undefined>(undefined)
  // The device toolbar's frame and zoom, remembered between visits in this browser.
  const [device, setDevice] = useState<DeviceSettings>(readDeviceSettings)
  useEffect(() => writeDeviceSettings(device), [device])
  const deviceFrame = device.frame
  const setDeviceFrame = (frame: DeviceFrame | undefined) => setDevice(current => ({ ...current, frame }))

  // `undefined` when not presenting. The viewer's own way in keeps the frame; `?present=fill` fills the window.
  const [presenting, setPresentingState] = useState(() => presentModeIn(window.location.search))
  const setPresenting = useCallback((mode: PresentMode | undefined) => {
    setPresentingState(mode)
    writePresenting(mode)
  }, [])
  const stopPresenting = useCallback(() => setPresenting(undefined), [setPresenting])
  const visibleBox = useVisibleBox()
  const [stageRef, stageSize] = useElementSize<HTMLElement>()

  const { toggles, toggle, setToggle } = useViewToggles()
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined)
  const [hoveredPath, setHoveredPath] = useState<string | undefined>(undefined)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [composing, setComposing] = useState<'new' | Annotation | undefined>(undefined)
  const [author, setAuthor] = useState(rememberedAuthor)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  const [naming, setNaming] = useState(false)
  const [namingError, setNamingError] = useState<string | undefined>(undefined)

  const frameRef = useRef<HTMLDivElement>(null)
  // On the canvas the picked frame's screen is what the tree reads and Inspect picks in; the canvas
  // says which element that is as the frame is drawn, and the count makes the hooks read it again.
  const canvasMountRef = useRef<HTMLElement | null>(null)
  const [canvasMount, setCanvasMount] = useState(0)
  const onInspectRoot = useCallback((mount: HTMLElement | null) => {
    if (canvasMountRef.current !== mount) {
      canvasMountRef.current = mount
      setCanvasMount(count => count + 1)
    }
  }, [])
  const inspectRef: RefObject<HTMLElement | null> = toggles.canvas ? canvasMountRef : frameRef
  // The stage leaves the DOM while the canvas is open, so what was measured on it has to go too.
  const stage = presenting !== undefined ? 'present' : toggles.canvas ? `canvas:${canvasMount}` : 'stage'
  const revision = `${state.slug}/${state.current.screenId}/${state.current.variant}/${stage}`
  const probed = useFlowLinks(prototype, toggles.canvas, runtimeVersion)
  // A link to a state outside the version draws no arrow, rather than one to a missing card.
  const flow = useMemo(() => {
    if (fullPrototype === undefined || versions === undefined || state.version === undefined) {
      return probed
    }
    const linksByNode = new Map<FlowNodeKey, ScreenLinks>()
    for (const [key, links] of probed.linksByNode) {
      linksByNode.set(key, {
        ...links,
        links: links.links.filter(link => {
          if (link.kind !== 'screen') {
            return true
          }
          const target = resolveScreen(fullPrototype, {
            screenId: link.screenId,
            variant: link.variant ?? DEFAULT_VARIANT,
          })
          return target === undefined || listedIn(versions, state.version, target)
        }),
      })
    }
    return { ...probed, linksByNode }
  }, [probed, fullPrototype, versions, state.version])
  // How the canvas opens: `v` centres it on the screen open now; `f`, the old flow map key, fits it all.
  const [canvasOpening, setCanvasOpening] = useState<'fit' | 'selection'>('selection')
  const [panelTab, setPanelTab] = useState<PanelTab>('doc')
  // Turning Inspect on, from any button or key, opens the Dev tab, which is where a picked element
  // is explained; a comment being written keeps its tab. Turning it off closes the panel again when
  // the Dev tab is what it shows, and leaves any other tab open.
  const wasInspecting = useRef(toggles.inspect)
  useEffect(() => {
    if (toggles.inspect && !wasInspecting.current && composing === undefined) {
      setToggle('doc', true)
      setPanelTab('dev')
    }
    if (!toggles.inspect && wasInspecting.current && panelTab === 'dev') {
      setToggle('doc', false)
    }
    wasInspecting.current = toggles.inspect
  }, [toggles.inspect, composing, panelTab, setToggle])
  // A pin clicked on another frame changes the screen and picks its note in one go; the reset below
  // that drops a note when the screen changes must leave that one alone.
  const keepNote = useRef<string | undefined>(undefined)

  const notes: NumberedAnnotation[] = useMemo(() => {
    if (prototype === undefined) {
      return []
    }
    return annotationsForScreen(prototype.annotations, state.current.screenId).map((note, index) => ({
      ...note,
      number: index + 1,
    }))
  }, [prototype, state.current.screenId])

  const noteCountByScreen = useMemo(() => {
    const counts = new Map<string, number>()
    if (prototype !== undefined) {
      for (const candidate of distinctScreens(prototype)) {
        counts.set(candidate.id, annotationsForScreen(prototype.annotations, candidate.id).length)
      }
    }
    return counts
  }, [prototype])

  const tree = useComponentTree(inspectRef, revision)
  const targets = useMemo(() => notes.map(note => note.target), [notes])
  const rects = useAnchorRects(inspectRef, targets, tree, revision)
  const unanchored = useMemo(
    () => new Set(notes.filter(note => !rects.has(note.target)).map(note => note.id)),
    [notes, rects]
  )
  const storybook = useStorybookLinks(storybookOptions)
  // The URL holds the pick, so it resolves against whatever tree the screen turns out to have —
  // on this render, or on the one after a link is opened cold.
  const selectedPath = useMemo(
    () => (state.component === undefined ? undefined : resolveComponentSelector(tree, state.component)),
    [tree, state.component]
  )
  const picked = useMemo(() => {
    const node = selectedPath === undefined ? undefined : tree.nodeByPath.get(selectedPath)
    if (node === undefined) {
      return undefined
    }
    const element = tree.elementByPath.get(node.path)
    return {
      target: componentSelector(tree, node),
      // An element the screen already names needs no new one; one the stamp reached can be given one.
      source: node.anchorId === undefined ? (element?.getAttribute(SOURCE_ATTRIBUTE) ?? undefined) : undefined,
      suggestedName: suggestAnchorId(node.label, element?.textContent ?? ''),
    }
  }, [tree, selectedPath])
  const pickedTarget = picked?.target

  // A link can name a component this screen does not have: the screen changed, or the link is old.
  const missingComponent =
    state.component !== undefined && selectedPath === undefined && tree.roots.length > 0 ? state.component : undefined
  const selectedElement = selectedPath === undefined ? undefined : tree.elementByPath.get(selectedPath)
  const hoveredElement = hoveredPath === undefined ? undefined : tree.elementByPath.get(hoveredPath)
  const inspectRects = useInspectRects(inspectRef, selectedElement, hoveredElement, revision)

  // Measuring: Alt held, or Measure on, measures from the picked element to the hovered one, or
  // shows the hovered one's own spacing when nothing is picked.
  const altHeld = useKeyHeld('Alt')
  const [measureOn, setMeasureOn] = useState(false)
  const measuring = altHeld || measureOn
  const measurements = useMemo(
    () =>
      measuring &&
      inspectRects.selected !== undefined &&
      inspectRects.hovered !== undefined &&
      hoveredPath !== selectedPath
        ? measureBetween(inspectRects.selected, inspectRects.hovered)
        : [],
    [measuring, inspectRects, hoveredPath, selectedPath]
  )
  const spacing =
    measuring &&
    inspectRects.selected === undefined &&
    inspectRects.hovered !== undefined &&
    hoveredElement !== undefined
      ? { rect: inspectRects.hovered, model: boxModel(getComputedStyle(hoveredElement)) }
      : undefined

  const selectPath = useCallback(
    (path: string | undefined) => {
      const node = path === undefined ? undefined : tree.nodeByPath.get(path)
      session.pickComponent(node === undefined ? undefined : componentSelector(tree, node))
      if (path === undefined) {
        return
      }
      // Open whatever the person had collapsed above the row, so the pick is visible.
      setCollapsed(current => {
        const next = new Set(current)
        for (const ancestor of ancestorPaths(path)) {
          next.delete(ancestor)
        }
        return next
      })
    },
    [tree, session.pickComponent]
  )

  /**
   * Gives the picked element a semantic id of its own. The screen file changes, so the screen
   * reloads with the element named; pointing the pick at the new id keeps the link durable.
   */
  const nameComponent = useCallback(
    (id: string) => {
      const source = picked?.source
      if (source === undefined) {
        return
      }
      setNaming(true)
      setNamingError(undefined)
      void (async () => {
        try {
          await nameElement(source, id)
          session.pickComponent(id)
        } catch (thrown) {
          setNamingError(thrown instanceof Error ? thrown.message : String(thrown))
        } finally {
          setNaming(false)
        }
      })()
    },
    [picked, session.pickComponent]
  )

  const clearComponent = useCallback(() => {
    session.pickComponent(undefined)
  }, [session.pickComponent])

  const pickComponent = useCallback(
    (element: Element) => {
      const path = nearestNodePath(tree, element)
      if (path !== undefined) {
        selectPath(path)
      }
    },
    [tree, selectPath]
  )

  const hoverComponent = useCallback(
    (element: Element | undefined) => {
      setHoveredPath(element === undefined ? undefined : nearestNodePath(tree, element))
    },
    [tree]
  )

  // Presenting shows the screen as the app would: clicks navigate, nothing is picked.
  useInspectMode({
    frameRef: inspectRef,
    enabled: toggles.inspect && presenting === undefined,
    onPick: pickComponent,
    onHover: hoverComponent,
  })

  const applyEdit = useCallback(
    async (edit: AnnotationEdit) => {
      if (prototype === undefined) {
        return
      }
      setSaving(true)
      setSaveError(undefined)
      try {
        const notes = await saveAnnotationEdit(prototype.slug, edit)
        // The server answers with the file as it now stands, so the panel shows what was written.
        setPrototypes(current =>
          current.map(candidate =>
            candidate.slug === prototype.slug ? { ...candidate, annotations: notes } : candidate
          )
        )
        setComposing(undefined)
      } catch (thrown) {
        setSaveError(thrown instanceof Error ? thrown.message : String(thrown))
      } finally {
        setSaving(false)
      }
    },
    [prototype]
  )

  const saveComment = useCallback(
    (draft: CommentDraft) => {
      if (prototype === undefined || composing === undefined) {
        return
      }
      const target = composing === 'new' ? pickedTarget : composing.target
      if (target === undefined) {
        return
      }
      // A new comment on an element with no id of its own names it as it saves, unless the name
      // was cleared: then the comment is pinned by position and the screen is left alone.
      const source = composing === 'new' ? picked?.source : undefined
      const newName = source === undefined ? undefined : chosenName(draft)

      try {
        window.localStorage.setItem(AUTHOR_KEY, draft.author)
      } catch {
        // A browser that refuses storage still saves the comment; only the name is forgotten.
      }
      setAuthor(draft.author)

      const taken = (fullPrototype ?? prototype).annotations.map(note => note.id)
      const note: Annotation = {
        id: composing === 'new' ? annotationId(draft.title, taken) : composing.id,
        // An edit keeps the versions the note was written for.
        ...(composing === 'new' || composing.since === undefined ? {} : { since: composing.since }),
        ...(composing === 'new' || composing.until === undefined ? {} : { until: composing.until }),
        target,
        screen: state.current.screenId,
        kind: draft.kind,
        title: draft.title.trim(),
        ...(draft.body.trim() === '' ? {} : { body: draft.body.trim() }),
        ...(draft.author.trim() === '' ? {} : { author: draft.author.trim() }),
        status: composing === 'new' ? 'open' : (composing.status ?? 'open'),
      }
      void (async () => {
        // The name goes into the screen first, so the comment can point at it rather than at a
        // path through the tree. A screen that refuses the edit keeps the comment unsaved and says
        // why, rather than leaving a comment pinned to a name that is not there.
        if (source !== undefined && newName !== undefined) {
          setSaving(true)
          try {
            await nameElement(source, newName)
          } catch (thrown) {
            setSaveError(thrown instanceof Error ? thrown.message : String(thrown))
            setSaving(false)
            return
          }
        }
        await applyEdit({ op: 'save', note: { ...note, target: newName ?? target } })
      })()
    },
    [applyEdit, composing, picked, pickedTarget, prototype, fullPrototype, state.current.screenId]
  )

  /**
   * Saves how the canvas is arranged. The file the server wrote is the one the viewer now holds, so
   * the problem lines about the old file go with it.
   */
  const arrangeCanvas = useCallback(
    async (canvas: CanvasFile) => {
      if (prototype === undefined) {
        return
      }
      await saveCanvas(prototype.slug, canvas)
      setPrototypes(current =>
        current.map(candidate =>
          candidate.slug === prototype.slug
            ? { ...candidate, canvas, issues: candidate.issues.filter(issue => !issue.startsWith('canvas.json:')) }
            : candidate
        )
      )
    },
    [prototype]
  )

  const toggleCollapsed = useCallback((path: string) => {
    setCollapsed(current => {
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const canvasOpen = useRef(toggles.canvas)
  canvasOpen.current = toggles.canvas

  // Back on the stage, the next `v` opens the canvas on the screen again.
  useEffect(() => {
    if (!toggles.canvas) {
      setCanvasOpening('selection')
    }
  }, [toggles.canvas])

  /** `f` opens the canvas with its arrows, fitted to the whole flow, as the flow map opened; again, it closes it. */
  const openFlow = useCallback(() => {
    if (canvasOpen.current && toggles.arrows) {
      setToggle('canvas', false)
      return
    }
    setCanvasOpening('fit')
    setToggle('arrows', true)
    setToggle('canvas', true)
  }, [setToggle, toggles.arrows])

  // A note belongs to the screen it was written on; a hover to the tree it was made in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect runs to clear this state whenever `revision` changes.
  useEffect(() => {
    setSelectedNoteId(keepNote.current)
    keepNote.current = undefined
    setHoveredPath(undefined)
    setComposing(undefined)
    setSaveError(undefined)
    setNamingError(undefined)
  }, [revision])

  const canPresent = screen !== undefined
  const presentingScreen = presenting !== undefined && canPresent
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target !== null && target.closest('input, textarea, select, [contenteditable]') !== null
      if (event.metaKey || event.ctrlKey || typing) {
        return
      }
      // Presenting takes only Esc, and not one the screen used to close its own dialog or menu.
      if (presentingScreen) {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          stopPresenting()
        }
        return
      }
      const named = TOGGLE_KEYS[event.key]
      if (named !== undefined) {
        toggle(named)
      }
      if (event.key === 'a' && canvasOpen.current) {
        toggle('arrows')
      }
      if (event.key === 'f') {
        openFlow()
      }
      if (event.key === 'p' && canPresent) {
        setPresenting('frame')
      }
      if (event.key === 'm') {
        setMeasureOn(on => !on)
      }
      if (event.key === 'Escape') {
        setSelectedNoteId(undefined)
        clearComponent()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canPresent, clearComponent, openFlow, presentingScreen, setPresenting, stopPresenting, toggle])

  if (prototype === undefined || fullPrototype === undefined) {
    return <EmptyLab />
  }

  // The frame takes the default viewport's size (the switcher's pick, or the screen's own) until the
  // device toolbar sets one; then the viewport is the one that size's width belongs to.
  const defaultViewport = viewportOverride ?? screen?.viewport ?? 'desktop'
  const chosenViewport = deviceFrame === undefined ? viewportOverride : viewportOfWidth(deviceFrame.width)
  const viewport = chosenViewport ?? defaultViewport
  const defaultFrameSize = { width: VIEWPORT_WIDTH[defaultViewport], height: FRAME_HEIGHT[defaultViewport] }
  const defaultName = `${VIEWPORT_LABEL[defaultViewport]} default`
  const frameSize = deviceFrame ?? defaultFrameSize
  // An on-screen keyboard covers the stage without changing the zoom, so typing never shrinks the screen.
  const keyboardInset = Math.max(0, window.innerHeight - visibleBox.height)
  const scale = frameScale(device.zoom, fitScale(stageSize, frameSize, keyboardInset))

  const navigation: ScreenNavigation = {
    screenId: state.current.screenId,
    variant: state.current.variant,
    goToScreen: (screenId, options) => {
      if (!canOpen(screenId, options?.variant)) {
        return
      }
      setSelectedNoteId(undefined)
      setToggle('canvas', false)
      session.goToScreen(screenId, options)
    },
    back: () => {
      setSelectedNoteId(undefined)
      session.back()
    },
    canGoBack: session.canGoBack,
    showHotspots: toggles.hotspots,
    ...(runtimeVersion === undefined ? {} : { version: runtimeVersion }),
  }

  // The outlines and measurements drawn over the screen being inspected, on the stage or the canvas.
  const pickedNode = selectedPath === undefined ? undefined : tree.nodeByPath.get(selectedPath)
  const inspectOverlay = (
    <>
      <InspectOverlay
        {...inspectRects}
        {...(selectedPath === undefined ? {} : { label: pickedNode?.label ?? selectedPath })}
      />
      {(measurements.length > 0 || spacing !== undefined) && (
        <MeasureOverlay measurements={measurements} {...(spacing === undefined ? {} : { spacing })} />
      )}
    </>
  )
  const pickedStory =
    pickedNode?.kind === 'component' ? findStorybookLink(storybook.links, pickedNode.label) : undefined
  const devPanel = (
    <DevPanel
      {...(selectedElement === undefined ? {} : { element: selectedElement })}
      {...(inspectRef.current === null ? {} : { frame: inspectRef.current })}
      {...(pickedNode === undefined ? {} : { label: pickedNode.label })}
      {...(pickedTarget === undefined ? {} : { selector: pickedTarget })}
      {...(pickedNode?.anchorId === undefined ? {} : { anchorId: pickedNode.anchorId })}
      {...(pickedStory === undefined ? {} : { storybookLink: pickedStory })}
      canOpenSource={canEditAnnotations()}
      inspecting={toggles.inspect}
      onToggleInspect={() => toggle('inspect')}
      measuring={measuring}
      onToggleMeasure={() => setMeasureOn(on => !on)}
      measurements={measurements}
      onDownloadScreen={async () => {
        const frame = inspectRef.current
        if (frame === null) {
          throw new Error('There is no screen on show.')
        }
        await exportPng(frame, pngFileName(prototype.slug, state.current.screenId, state.current.variant))
      }}
    />
  )

  if (presentingScreen) {
    return (
      <>
        <ViewerToast message={toast} onDismiss={dismissToast} />
        <PresentingStage box={visibleBox} size={presenting === 'fill' ? undefined : frameSize} onExit={stopPresenting}>
          {screenMissing === undefined ? (
            <PrototypeRuntime value={{ ...navigation, showHotspots: false }}>
              <screen.Component />
            </PrototypeRuntime>
          ) : (
            <VersionPlaceholder
              name={`${screen.title} · ${screen.variantLabel}`}
              missing={screenMissing}
              onSwitch={session.pickVersion}
            />
          )}
        </PresentingStage>
      </>
    )
  }

  return (
    <VersionProvider value={runtimeVersion}>
      <div
        className='fixed inset-x-0 flex flex-col bg-muted'
        style={{ top: visibleBox.top, height: visibleBox.height }}
      >
        <ViewerToast message={toast} onDismiss={dismissToast} />
        <ViewerHeader
          prototypes={prototypes}
          slug={prototype.slug}
          onOpenPrototype={slug => {
            setViewportOverride(undefined)
            setSelectedNoteId(undefined)
            session.openPrototype(slug)
          }}
          {...(viewportSwitcher
            ? {
                viewport,
                onViewportChange: (next: ScreenViewport) => {
                  setViewportOverride(next)
                  setDeviceFrame(undefined)
                },
              }
            : {})}
          toggles={toggles}
          onToggle={toggle}
          noteCount={notes.length}
          canGoBack={session.canGoBack}
          onBack={navigation.back}
          onRestart={session.restart}
          device={{
            frame: deviceFrame,
            onFrame: setDeviceFrame,
            defaultSize: defaultFrameSize,
            defaultName,
            zoom: device.zoom,
            onZoom: zoom => setDevice(current => ({ ...current, zoom })),
          }}
          {...(canPresent ? { onPresent: () => setPresenting('frame') } : {})}
          {...(versions === undefined ? {} : { versions })}
          {...(state.version === undefined ? {} : { version: state.version })}
          onVersionChange={session.pickVersion}
          {...(player === undefined ? {} : { playerHref: player })}
        />

        <div className='flex min-h-0 flex-1'>
          <SlidePanel open={toggles.screens} side='left' widthClass='w-64' animate={!toggles.canvas}>
            <ViewerSidebar
              prototype={prototype}
              screenId={state.current.screenId}
              variant={state.current.variant}
              noteCountByScreen={noteCountByScreen}
              onSelectScreen={screenId =>
                // On the canvas, picking a screen in the list picks its frame and stays on the canvas.
                toggles.canvas ? session.showScreen(screenId, DEFAULT_VARIANT) : navigation.goToScreen(screenId)
              }
              onSelectVariant={session.selectVariant}
              {...(chipVersions === undefined ? {} : { chipVersions })}
              components={{
                tree,
                ...(selectedPath === undefined ? {} : { selectedPath }),
                ...(hoveredPath === undefined ? {} : { hoveredPath }),
                collapsed,
                onSelect: selectPath,
                onHover: setHoveredPath,
                onToggle: toggleCollapsed,
                storybookLinks: storybook.links,
                storybookStatus: storybook.status,
                storybookUrl: storybook.url,
                ...(missingComponent === undefined ? {} : { missingComponent }),
                ...(picked?.source === undefined || !canEditAnnotations()
                  ? {}
                  : { suggestedName: picked.suggestedName }),
                onName: nameComponent,
                naming,
                ...(namingError === undefined ? {} : { namingError }),
              }}
            />
          </SlidePanel>

          <main
            ref={stageRef}
            className={cn(
              'flex min-h-0 flex-1',
              // The frame centres itself with auto margins, which, unlike `justify-center`, leave a
              // frame wider than the stage scrollable from its left edge.
              toggles.canvas
                ? 'justify-center overflow-hidden'
                : 'overflow-auto overscroll-contain pt-8 pr-10 pb-10 pl-6'
            )}
          >
            {toggles.canvas ? (
              <CanvasView
                prototype={prototype}
                flow={flow}
                showHotspots={toggles.hotspots}
                showNotes={toggles.notes}
                arrows={toggles.arrows}
                onToggleArrows={() => toggle('arrows')}
                {...(deviceFrame !== undefined
                  ? { frameSize: deviceFrame }
                  : viewportOverride === undefined
                    ? {}
                    : {
                        frameSize: { width: VIEWPORT_WIDTH[viewportOverride], height: FRAME_HEIGHT[viewportOverride] },
                      })}
                selectedKey={screen === undefined ? undefined : flowNodeKey(screen.id, screen.variant)}
                onSelect={session.showScreen}
                onOpen={(screenId, variant) => {
                  session.showScreen(screenId, variant)
                  setToggle('canvas', false)
                }}
                selectedNoteId={selectedNoteId}
                onPin={(screenId, variant, noteId) => {
                  const moving = screenId !== state.current.screenId || variant !== state.current.variant
                  if (moving) {
                    keepNote.current = noteId
                  }
                  session.showScreen(screenId, variant)
                  setSelectedNoteId(noteId)
                  if (noteId !== undefined) {
                    setPanelTab('notes')
                    setToggle('doc', true)
                  }
                }}
                opening={canvasOpening}
                canArrange={canEditAnnotations()}
                onArrange={arrangeCanvas}
                canOpen={canOpen}
                inspecting={toggles.inspect}
                onInspectRoot={onInspectRoot}
                inspectOverlay={inspectOverlay}
              />
            ) : screen === undefined ? (
              <p className='mx-auto self-center text-muted-foreground text-sm'>
                This prototype has no screens yet. The Problems tab lists what is missing.
              </p>
            ) : (
              <ResizableFrame
                size={frameSize}
                scale={scale}
                caption={frameCaption(frameSize, frameName(deviceFrame, defaultName.toLowerCase()), scale)}
                onResize={size => setDeviceFrame(size)}
                onReset={() => setDeviceFrame(undefined)}
              >
                <PrototypeFrame
                  viewport={viewport}
                  frameRef={frameRef}
                  size={frameSize}
                  inspecting={toggles.inspect}
                  overlay={
                    <>
                      {inspectOverlay}
                      {toggles.notes && (
                        <AnnotationOverlay
                          notes={notes}
                          rects={rects}
                          {...(selectedNoteId === undefined ? {} : { selectedId: selectedNoteId })}
                          onSelect={setSelectedNoteId}
                        />
                      )}
                    </>
                  }
                >
                  {screenMissing === undefined ? (
                    <PrototypeRuntime value={navigation}>
                      <screen.Component />
                    </PrototypeRuntime>
                  ) : (
                    <VersionPlaceholder
                      name={`${screen.title} · ${screen.variantLabel}`}
                      missing={screenMissing}
                      onSwitch={session.pickVersion}
                    />
                  )}
                </PrototypeFrame>
              </ResizableFrame>
            )}
          </main>

          <SlidePanel open={toggles.doc} side='right' widthClass='w-96' animate={!toggles.canvas}>
            <SidePanel
              prototype={fullPrototype}
              tab={panelTab}
              onTabChange={setPanelTab}
              notes={notes}
              // The canvas does not measure the open screen's targets, so it reports none as missing.
              unanchored={toggles.canvas ? NONE_MISSING : unanchored}
              {...(selectedNoteId === undefined ? {} : { selectedId: selectedNoteId })}
              onSelect={setSelectedNoteId}
              {...(pickedTarget === undefined ? {} : { target: pickedTarget })}
              {...(picked?.source === undefined ? {} : { suggestedName: picked.suggestedName })}
              canEdit={canEditAnnotations()}
              {...(composing === undefined ? {} : { composing })}
              onCompose={setComposing}
              onSave={saveComment}
              onDelete={note => void applyEdit({ op: 'delete', id: note.id })}
              onToggleResolved={note =>
                void applyEdit({
                  op: 'save',
                  note: { ...note, status: note.status === 'resolved' ? 'open' : 'resolved' },
                })
              }
              author={author}
              saving={saving}
              dev={devPanel}
              {...(chipVersions === undefined ? {} : { chipVersions })}
              {...(saveError === undefined ? {} : { saveError })}
            />
          </SlidePanel>
        </div>
      </div>
    </VersionProvider>
  )
}
