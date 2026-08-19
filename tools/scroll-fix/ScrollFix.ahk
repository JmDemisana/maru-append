#Requires AutoHotkey >=2.0

threshold := 50
lastDir := 0
lastTime := 0

WheelUp::
{
    global lastDir, lastTime
    if (A_TickCount - lastTime > threshold || lastDir != 1) {
        lastDir := 1
        lastTime := A_TickCount
        Send "{WheelUp}"
    }
}

WheelDown::
{
    global lastDir, lastTime
    if (A_TickCount - lastTime > threshold || lastDir != -1) {
        lastDir := -1
        lastTime := A_TickCount
        Send "{WheelDown}"
    }
}
