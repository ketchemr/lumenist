# Agent Instructions

- **Do not start a browser**: Never invoke browser automation, webview agents, headless browsers, or open browser windows. The user will manually check and verify results in their own browser.
- **Do not start or stop local servers**: The user will start and stop the local development server for testing themselves. Never spawn server processes or background daemons.
- **Do not commit or sync git**: The user will use their IDE for git commit and sync. Do not run git commit, push, or sync commands.
