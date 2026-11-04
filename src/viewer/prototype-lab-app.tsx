import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnnotationOverlay, type NumberedAnnotation } from '../components/annotation-overlay'
import { InspectOverlay } from '../components/inspect-overlay'
import { PrototypeFrame } from '../components/prototype-frame'
import { PrototypeRuntime, type ScreenNavigation } from '../components/prototype-runtime'
import { ResizableFrame } from '../components/resizable-frame'
import { useAnchorRects } from '../hooks/use-anchor-rects'
import { useComponentTree } from '../hooks/use-component-tree'
import { useElementSize } from '../hooks/use-element-size'
import { useFlowLinks } from '../hooks/use-flow-links'
import { useInspectMode } from '../hooks/use-inspect-mode'
import { useInspectRects } from '../hooks/use-inspect-rects'
import { usePrototypeSession } from '../hooks/use-prototype-session'
import { useStorybookLinks } from '../hooks/use-storybook-links'
import { TOGGLE_KEYS, useViewToggles } from '../hooks/use-view-toggles'
import { useVisibleBox } from '../hooks/use-visible-box'
import { useWindowViewport } from '../hooks/use-window-viewport'
import { type AnnotationEdit, annotationId } from '../lib/annotation-edit'
import { annotationsForScreen } from '../lib/annotations'
import { canEditAnnotations, nameElement, saveAnnotationEdit } from '../lib/annotations-api'
import { componentSelector, resolveComponentSelector } from '../lib/component-link'
import { ancestorPaths, nearestNodePath } from '../lib/component-tree'
import { FRAME_HEIGHT, VIEWPORT_LABEL, VIEWPORT_WIDTH } from '../lib/constants'
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
import { distinctScreens } from '../lib/discovery'
import { presentingIn, writePresenting } from '../lib/present-param'
import { SOURCE_ATTRIBUTE, suggestAnchorId } from '../lib/source-ref'
import type { StorybookOptions } from '../lib/storybook-links'
import type { Annotation, Prototype, ScreenViewport } from '../types'
import { cn } from '../ui'
import { type CommentDraft, chosenName } from './comment-composer'
import { EmptyLab } from './empty-lab'
import { FlowMap } from './flow-map'
import { PresentingStage } from './presenting-stage'
import { SidePanel } from './side-panel'
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
}

const AUTHOR_KEY = 'prototype-lab.author'

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
 * closes, so the screen can have the window to itself. The stage can give way to the flow map,
 * which shows every screen and where each control leads.
 */
export function PrototypeLabApp({
  prototypes: loaded,
  storybook: storybookOptions,
  viewportSwitcher = true,
}: PrototypeLabAppProps) {
  const [prototypes, setPrototypes] = useState(loaded)
  const session = usePrototypeSession(prototypes)
  const { prototype, screen, state } = session

  const [viewportOverride, setViewportOverride] = useState<ScreenViewport | undefined>(undefined)
  // The device toolbar's frame and zoom, remembered between visits in this browser.
  const [device, setDevice] = useState<DeviceSettings>(readDeviceSettings)
  useEffect(() => writeDeviceSettings(device), [device])
  const deviceFrame = device.frame
  const setDeviceFrame = (frame: DeviceFrame | undefined) => setDevice(current => ({ ...current, frame }))

  const [presenting, setPresentingState] = useState(() => presentingIn(window.location.search))
  const setPresenting = useCallback((on: boolean) => {
    setPresentingState(on)
    writePresenting(on)
  }, [])
  const stopPresenting = useCallback(() => setPresenting(false), [setPresenting])
  const windowViewport = useWindowViewport(presenting)
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
  // The stage leaves the DOM while the map is open, so what was measured on it has to go too.
  const stage = presenting ? 'present' : toggles.flow ? 'flow' : 'stage'
  const revision = `${state.slug}/${state.current.screenId}/${state.current.variant}/${stage}`
  const flow = useFlowLinks(prototype, toggles.flow)

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

  const tree = useComponentTree(frameRef, revision)
  const targets = useMemo(() => notes.map(note => note.target), [notes])
  const rects = useAnchorRects(frameRef, targets, tree, revision)
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
  const inspectRects = useInspectRects(frameRef, selectedElement, hoveredElement, revision)

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
  useInspectMode({ frameRef, enabled: toggles.inspect && !presenting, onPick: pickComponent, onHover: hoverComponent })

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

      const taken = prototype.annotations.map(note => note.id)
      const note: Annotation = {
        id: composing === 'new' ? annotationId(draft.title, taken) : composing.id,
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
    [applyEdit, composing, picked, pickedTarget, prototype, state.current.screenId]
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

  // A note belongs to the screen it was written on; a hover to the tree it was made in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect runs to clear this state whenever `revision` changes.
  useEffect(() => {
    setSelectedNoteId(undefined)
    setHoveredPath(undefined)
    setComposing(undefined)
    setSaveError(undefined)
    setNamingError(undefined)
  }, [revision])

  const canPresent = screen !== undefined
  const presentingScreen = presenting && canPresent
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
      if (event.key === 'p' && canPresent) {
        setPresenting(true)
      }
      if (event.key === 'Escape') {
        setSelectedNoteId(undefined)
        clearComponent()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canPresent, clearComponent, presentingScreen, setPresenting, stopPresenting, toggle])

  if (prototype === undefined) {
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
      setSelectedNoteId(undefined)
      setToggle('flow', false)
      session.goToScreen(screenId, options)
    },
    back: () => {
      setSelectedNoteId(undefined)
      session.back()
    },
    canGoBack: session.canGoBack,
    showHotspots: toggles.hotspots,
  }

  if (presentingScreen) {
    return (
      <PresentingStage viewport={windowViewport} box={visibleBox} onExit={stopPresenting}>
        <PrototypeRuntime value={{ ...navigation, showHotspots: false }}>
          <screen.Component />
        </PrototypeRuntime>
      </PresentingStage>
    )
  }

  return (
    <div className='fixed inset-x-0 flex flex-col bg-muted' style={{ top: visibleBox.top, height: visibleBox.height }}>
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
        device={{
          frame: deviceFrame,
          onFrame: setDeviceFrame,
          defaultSize: defaultFrameSize,
          defaultName,
          zoom: device.zoom,
          onZoom: zoom => setDevice(current => ({ ...current, zoom })),
        }}
        {...(canPresent ? { onPresent: () => setPresenting(true) } : {})}
        toggles={toggles}
        onToggle={toggle}
        noteCount={notes.length}
        canGoBack={session.canGoBack}
        onBack={navigation.back}
        onRestart={session.restart}
      />

      <div className='flex min-h-0 flex-1'>
        {toggles.screens && (
          <ViewerSidebar
            prototype={prototype}
            screenId={state.current.screenId}
            variant={state.current.variant}
            noteCountByScreen={noteCountByScreen}
            onSelectScreen={navigation.goToScreen}
            onSelectVariant={variant => {
              setToggle('flow', false)
              session.selectVariant(variant)
            }}
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
              ...(picked?.source === undefined || !canEditAnnotations() ? {} : { suggestedName: picked.suggestedName }),
              onName: nameComponent,
              naming,
              ...(namingError === undefined ? {} : { namingError }),
            }}
          />
        )}

        <main
          ref={stageRef}
          className={cn(
            'flex min-h-0 flex-1',
            // The frame centres itself with auto margins, which, unlike `justify-center`, leave a
            // frame wider than the stage scrollable from its left edge.
            toggles.flow ? 'justify-center overflow-hidden' : 'overflow-auto overscroll-contain pt-8 pr-10 pb-10 pl-6'
          )}
        >
          {toggles.flow ? (
            <FlowMap
              prototype={prototype}
              flow={flow}
              showHotspots={toggles.hotspots}
              {...(chosenViewport === undefined ? {} : { viewport: chosenViewport })}
              onOpenScreen={(screenId, variant) => navigation.goToScreen(screenId, { variant })}
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
                    <InspectOverlay
                      {...inspectRects}
                      {...(selectedPath === undefined
                        ? {}
                        : { label: tree.nodeByPath.get(selectedPath)?.label ?? selectedPath })}
                    />
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
                <PrototypeRuntime value={navigation}>
                  <screen.Component />
                </PrototypeRuntime>
              </PrototypeFrame>
            </ResizableFrame>
          )}
        </main>

        {toggles.doc && (
          <SidePanel
            prototype={prototype}
            notes={notes}
            unanchored={unanchored}
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
            {...(saveError === undefined ? {} : { saveError })}
          />
        )}
      </div>
    </div>
  )
}
