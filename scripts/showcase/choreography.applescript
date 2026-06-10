-- choreography.applescript
-- Usage: osascript choreography.applescript <appProcessName> <demoFilePath> <stepDelaySeconds>
-- Positions windows, opens demo file, runs feature reel, emits APP_BOUNDS.

on run argv
  set appName to item 1 of argv
  set demoPath to item 2 of argv
  set stepDelay to (item 3 of argv) as number

  -- Get screen dimensions via Finder desktop bounds (l, t, r, b)
  tell application "Finder"
    set desktopBounds to bounds of window of desktop
  end tell
  set screenW to item 3 of desktopBounds
  set screenH to item 4 of desktopBounds

  -- Compute half-screen bounds
  set leftX to 0
  set leftY to 0
  set leftW to screenW div 2
  set leftH to screenH

  set rightX to screenW div 2
  set rightY to 0
  set rightW to screenW - rightX
  set rightH to screenH

  -- Position the app window to the left half
  tell application "System Events"
    try
      tell process appName
        set frontmost to true
        delay 0.3
        set position of front window to {leftX, leftY}
        set size of front window to {leftW, leftH}
      end tell
    on error errMsg
      log ("WARN: could not position app window: " & errMsg)
    end try
  end tell

  -- Position browser to right half (non-fatal if process name differs)
  tell application "System Events"
    try
      -- Try Google Chrome first, then Safari
      set browserFound to false
      repeat with bName in {"Google Chrome", "Safari", "Firefox", "Arc", "Brave Browser"}
        if (name of every process) contains (bName as text) then
          tell process (bName as text)
            set frontmost to true
            delay 0.3
            set position of front window to {rightX, rightY}
            set size of front window to {rightW, rightH}
          end tell
          set browserFound to true
          exit repeat
        end if
      end repeat
    on error errMsg
      log ("WARN: could not position browser window: " & errMsg)
    end try
  end tell

  -- Bring app to front and begin choreography
  tell application "System Events"
    tell process appName
      set frontmost to true
    end tell
  end tell
  delay stepDelay

  -- Open demo file via Cmd+O dialog, then Cmd+Shift+G go-to-path, paste path, confirm
  tell application "System Events"
    tell process appName
      -- Cmd+O: open file dialog
      keystroke "o" using command down
      delay stepDelay

      -- Cmd+Shift+G: "Go to folder" within the open dialog
      keystroke "g" using {command down, shift down}
      delay stepDelay

      -- Paste the demo file path
      set the clipboard to demoPath
      keystroke "v" using command down
      delay stepDelay

      -- Press Return to navigate to the folder
      key code 36
      delay stepDelay

      -- Press Return again to open the file
      key code 36
      delay (stepDelay * 3)
    end tell
  end tell

  -- Feature reel
  tell application "System Events"
    tell process appName

      -- Find: Cmd+F, type "Total", Escape
      keystroke "f" using command down
      delay stepDelay
      keystroke "Total"
      delay stepDelay
      key code 53
      delay stepDelay

      -- Summary/group-by panel: Cmd+Shift+Y, then Escape
      keystroke "y" using {command down, shift down}
      delay stepDelay
      key code 53
      delay stepDelay

      -- Zoom in twice: Cmd+=, Cmd+=
      keystroke "=" using command down
      delay stepDelay
      keystroke "=" using command down
      delay stepDelay

      -- Zoom reset: Cmd+0
      keystroke "0" using command down
      delay stepDelay

      -- Inline edit: F2 (key code 120), type "demo", Return, then Cmd+Z undo
      key code 120
      delay stepDelay
      keystroke "demo"
      delay stepDelay
      key code 36
      delay stepDelay
      keystroke "z" using command down
      delay stepDelay

    end tell
  end tell

  -- Re-read app front window bounds after choreography
  set appX to 0
  set appY to 0
  set appW to leftW
  set appH to leftH

  tell application "System Events"
    try
      tell process appName
        set winPos to position of front window
        set winSize to size of front window
        set appX to item 1 of winPos
        set appY to item 2 of winPos
        set appW to item 1 of winSize
        set appH to item 2 of winSize
      end tell
    on error errMsg
      log ("WARN: could not read app window bounds: " & errMsg)
    end try
  end tell

  -- Emit bounds — MUST be the only line matching "APP_BOUNDS" pattern on stdout/stderr
  log ("APP_BOUNDS " & appX & " " & appY & " " & appW & " " & appH)

end run
