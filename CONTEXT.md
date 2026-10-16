# Studio navigation

The studio displays app routes between screen frames on the blueprint board.

## Language

**Screen frame**:
A live app screen shown on the board, with its header and footer.
_Avoid_: Card, phone, node

**Declared screen order**:
The fixed sequence of screen frames, 01 to 07, that the studio defines.
_Avoid_: Board order, visual order

**Frame position**:
The current location of a screen frame on the board. The user can move it. It does not change the declared screen order.
_Avoid_: Layout slot

**Drag handle**:
The header and footer of a screen frame. A drag on the drag handle moves the frame.
_Avoid_: Grip, title bar

**Route connection**:
A directed link that represents a real app route between two screen frames. It attaches to the side midpoints of the frames.
_Avoid_: Sequence link

**Direct connection**:
A route connection between screen frames that are adjacent in the declared screen order.
_Avoid_: Main journey

**Detour**:
A route connection between screen frames that are not adjacent in the declared screen order.
_Avoid_: Conditional route

**Active connection**:
The route connection for the most recent navigation action.
_Avoid_: Selected connection

**Present mode**:
A read-only view of the studio that displays one screen frame large. It hides the studio panels, the other screen frames, and all editing controls.
_Avoid_: Slideshow, fullscreen

**Present bar**:
The small control strip in Present mode. It holds the screen label and position, the Light/Dark toggle, and the Exit control.
_Avoid_: Toolbar, chrome

**Shareable URL state**:
The state encoded in the web address so a link reproduces an exact studio view. It holds the present flag, the screen key, the scheme, and the token overrides.
_Avoid_: Link state, deep link

**Token overrides**:
The set of design-token edits the user made on top of the committed tokens. The store holds them as a flat map of dotted paths to values.
_Avoid_: Theme changes, edits

## Visual regression

**App surface**:
The 390 by 820 CSS-pixel app content inside a screen frame. It excludes the frame header, footer, and studio controls.
_Avoid_: Screen frame, card, phone

**Screenshot case**:
One app surface in one scheme and one screen state.
_Avoid_: Snapshot, frame shot

**Screenshot baseline**:
The committed PNG for one screenshot case. Linux produces it.
_Avoid_: Golden image, expected image

**Screenshot run**:
A completed capture and comparison of app surfaces against screenshot baselines.
_Avoid_: Test run, pixel check

**Regression tab**:
The studio panel that displays the recorded screenshot result.
_Avoid_: Render verdict, badge

**Capture mode**:
A test-only studio view that renders one app surface at scale 1. It is not Present mode, and it is not shareable URL state.
_Avoid_: Present mode, screenshot route

**Screenshot record**:
The committed description of the approved screenshot baselines and the commit that produced them.
_Avoid_: CI report, pass report

**Screenshot matrix**:
The screenshot cases derived from the screen registry, both schemes, and the empty Habit detail state.
_Avoid_: Fixed screen list, board PNG

## Guard

**Guarded file**:
A file under the app's screens or shared components that the guard keeps unchanged. The studio's own route and the shared-components seam are permanent exceptions.
_Avoid_: Locked file, protected file

**Guard permission**:
A commit trailer that names one guarded file and gives a reason. It lets that file change only in the range that contains the commit.
_Avoid_: Exception, bypass, unlock

## Analytics

**Analytics event**:
A record of one user action that the native app sends to Mixpanel. The studio on web sends none.
_Avoid_: Studio event, tracking call

**Event source**:
The native app running on a device or in the iOS Simulator. It is the only sender of analytics events.
_Avoid_: Browser, studio, Pages build
