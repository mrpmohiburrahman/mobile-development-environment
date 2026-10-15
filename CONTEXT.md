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
