import { existsSync } from 'fs';
import { join } from 'path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
  systemPreferences
} from 'electron';

import { registerBrowserHandlers } from './handlers/browser-handlers';
import { registerChatHandlers } from './handlers/chat-handlers';
import { registerConfigHandlers } from './handlers/config-handlers';
import { registerConversationHandlers } from './handlers/conversation-handlers';
import { registerFileHandlers } from './handlers/file-handlers';
import { registerOAuthHandlers } from './handlers/oauth-handlers';
import { registerShellHandlers } from './handlers/shell-handlers';
import { registerSplitHandlers } from './handlers/split-handlers';
import { registerUpdateHandlers } from './handlers/update-handlers';
import { registerWorkerHandlers } from './handlers/worker-handlers';
import {
  addRecentProject,
  buildEnhancedPath,
  ensureWorkspaceDir,
  getRecentProjects,
  loadConfig,
  saveConfig
} from './lib/config';
import { initializeUpdater, startPeriodicUpdateCheck } from './lib/updater';
import { loadWindowBounds, saveWindowBounds } from './lib/window-state';
import { createApplicationMenu } from './menu';

// Workaround for Electron 39.2.0 crash
// The crash occurs in v8::V8::EnableWebAssemblyTrapHandler during V8 initialization
app.commandLine.appendSwitch('disable-features', 'WebAssemblyTrapHandler');

// Fix PATH for all platforms - merge bundled binaries (bun, uv, git, msys2) with user's PATH
// This ensures bundled binaries are available while preserving user's existing PATH entries
process.env.PATH = buildEnhancedPath();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // electron-vite uses different extensions in dev (.cjs) vs production (.cjs)
  const isDev = process.env.ELECTRON_RENDERER_URL !== undefined;
  const preloadPath = join(__dirname, '../preload/index.cjs');

  // Load saved window bounds or use defaults
  const savedBounds = loadWindowBounds();
  const defaultBounds = { width: 1200, height: 800 };

  const iconPath = join(__dirname, '../../static/icon.png');
  const icon = existsSync(iconPath) ? iconPath : undefined;

  // Match background color to app UI to prevent white flash on resize
  const backgroundColor = nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#fafaf9'; // neutral-900 / neutral-50

  // titleBarStyle is macOS-only - on Windows/Linux, use default frame
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    ...defaultBounds,
    ...(savedBounds || {}),
    icon,
    backgroundColor,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true // Enable <webview> for browser tabs
    }
  };

  // macOS-specific: enable native tabs (default title bar)
  if (process.platform === 'darwin') {
    windowOptions.tabbingIdentifier = 'Claudesky';
  }

  mainWindow = new BrowserWindow(windowOptions);

  // electron-vite provides ELECTRON_RENDERER_URL in dev mode
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Prevent navigation to external URLs - open them in system browser instead
  const isLocalUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
      return (
        parsed.protocol === 'file:' ||
        localHosts.includes(parsed.hostname) ||
        parsed.hostname.endsWith('.local') ||
        parsed.hostname.endsWith('.localhost')
      );
    } catch {
      // If URL parsing fails, treat as local (relative paths, etc.)
      return true;
    }
  };

  // Block navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isLocalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url).catch((err) => {
        console.error('Failed to open external URL:', err);
      });
    }
  });

  // Handle new window requests (target="_blank", window.open, etc.)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalUrl(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('Failed to open external URL:', err);
      });
    }
    // Always deny new windows - external links open in system browser
    return { action: 'deny' };
  });

  // Save window bounds when resized or moved
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      saveWindowBounds(bounds);
    }
  };

  // Debounce the save to avoid excessive writes
  let saveBoundsTimeout: NodeJS.Timeout | null = null;
  const debouncedSaveBounds = () => {
    if (saveBoundsTimeout) {
      clearTimeout(saveBoundsTimeout);
    }
    saveBoundsTimeout = setTimeout(saveBounds, 500);
  };

  mainWindow.on('resize', debouncedSaveBounds);
  mainWindow.on('move', debouncedSaveBounds);

  mainWindow.on('closed', () => {
    // Save bounds one final time when closing
    saveBounds();
    // Home window closing = close ALL windows (quit the app)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.close();
      }
    });
    mainWindow = null;
  });
}

// Tab types supported by Claudesky
type TabType = 'project' | 'todos' | 'kanban' | 'notes' | 'picker' | 'browser';

// Create a new window/tab with specified type
function createTabWindow(type: TabType, projectPath?: string): BrowserWindow {
  console.log(`[createTabWindow] ===== CREATING TAB WINDOW =====`);
  console.log(`[createTabWindow] type: "${type}"`);
  console.log(`[createTabWindow] projectPath: "${projectPath}"`);
  const isDev = process.env.ELECTRON_RENDERER_URL !== undefined;
  const preloadPath = join(__dirname, '../preload/index.cjs');
  const iconPath = join(__dirname, '../../static/icon.png');
  const icon = existsSync(iconPath) ? iconPath : undefined;
  const backgroundColor = nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#fafaf9';

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    icon,
    backgroundColor,
    show: false, // Don't show until ready
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true // Enable <webview> for browser tabs
    }
  };

  // macOS-specific: enable native tabs (default title bar)
  if (process.platform === 'darwin') {
    windowOptions.tabbingIdentifier = 'Claudesky';
  }

  const win = new BrowserWindow(windowOptions);

  // Build query params based on tab type
  const query: Record<string, string> = { type };
  if (type === 'project' && projectPath) {
    query.project = projectPath;
  }

  // Load the app with appropriate query params
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    const params = new URLSearchParams(query).toString();
    const url = `${process.env.ELECTRON_RENDERER_URL}?${params}`;
    console.log(`[createTabWindow] Loading URL: ${url}`);
    win.loadURL(url);
  } else {
    console.log(`[createTabWindow] Loading file with query:`, query);
    win.loadFile(join(__dirname, '../renderer/index.html'), { query });
  }

  return win;
}

// Legacy function for backwards compatibility
function createProjectWindow(projectPath: string): BrowserWindow {
  return createTabWindow('project', projectPath);
}

app.whenReady().then(async () => {
  // Set app name
  app.name = 'Claudesky';

  // Set About panel options
  app.setAboutPanelOptions({
    copyright: 'Copyright © 2025 Claudesky'
  });

  // Default to dark theme for native title bar (most Claudesky themes are dark)
  // This will be overridden when renderer syncs the actual theme
  nativeTheme.themeSource = 'dark';
  console.log('[Electron] Set initial native theme to dark');

  // Request microphone permission on startup
  console.log('[Electron] Requesting microphone permission on startup...');
  systemPreferences.askForMediaAccess('microphone').then((granted) => {
    console.log('[Electron] Microphone permission:', granted ? 'granted' : 'denied');
  });

  // Register all IPC handlers
  registerBrowserHandlers();
  registerConfigHandlers();
  registerOAuthHandlers();
  registerChatHandlers(() => mainWindow);
  registerConversationHandlers();
  registerFileHandlers();
  registerShellHandlers();
  registerSplitHandlers();
  registerUpdateHandlers();
  registerWorkerHandlers(() => mainWindow);

  // IPC handler to open a project in a new native tab
  ipcMain.handle('project:open', async (event, projectPath: string) => {
    console.log(`[project:open] ========== OPENING PROJECT ==========`);
    console.log(`[project:open] Received projectPath: "${projectPath}"`);
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    const projectWindow = createProjectWindow(projectPath);

    console.log(`[project:open] Created window, projectPath was: "${projectPath}"`);

    // Extract project name from path (last directory component)
    const projectName = projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath;

    // Add to recent projects
    addRecentProject(projectPath, projectName);

    // Save the workspace directory so it persists across sessions
    const config = loadConfig();
    config.workspaceDir = projectPath;
    saveConfig(config);

    projectWindow.once('ready-to-show', () => {
      console.log(`[project:open] Project window ready-to-show`);

      // On macOS, add as tabbed window and focus
      if (process.platform === 'darwin' && sourceWindow && !sourceWindow.isDestroyed()) {
        sourceWindow.addTabbedWindow(projectWindow);
      }

      projectWindow.show();

      // Small delay to ensure tab is fully added before focusing
      setTimeout(() => {
        projectWindow.focus();
        projectWindow.moveTop();
        projectWindow.webContents.focus();
        console.log(`[project:open] Project window focused`);
      }, 50);
    });

    return { success: true };
  });

  // IPC handler to list recent projects
  ipcMain.handle('project:list-recent', async () => {
    const projects = getRecentProjects();
    return { projects };
  });

  // IPC handler to set the native theme (for native tab bar coloring)
  ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark' | 'system') => {
    console.log(`[theme:set] Setting native theme to: ${theme}`);
    nativeTheme.themeSource = theme;
    return { success: true };
  });

  // IPC handler to get current native theme
  ipcMain.handle('theme:get', () => {
    return {
      theme: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    };
  });

  // IPC handler to browse for a project folder
  ipcMain.handle('project:browse', async (event) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(sourceWindow || mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
      buttonLabel: 'Open Project'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { path: null, canceled: true };
    }

    return { path: result.filePaths[0], canceled: false };
  });

  // IPC handler to create a new tab of specific type
  ipcMain.handle(
    'tab:create',
    async (
      event,
      type: 'todos' | 'kanban' | 'notes' | 'picker' | 'browser',
      projectPath?: string
    ) => {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      const newTab = createTabWindow(type, projectPath);

      console.log(`[tab:create] Creating tab of type: ${type}`);

      newTab.once('ready-to-show', () => {
        console.log(`[tab:create] Tab ready-to-show: ${type}`);

        // On macOS, add as tabbed window and focus
        if (process.platform === 'darwin' && sourceWindow && !sourceWindow.isDestroyed()) {
          sourceWindow.addTabbedWindow(newTab);
        }

        newTab.show();

        // Small delay to ensure tab is fully added before focusing
        setTimeout(() => {
          newTab.focus();
          newTab.moveTop();
          newTab.webContents.focus();
          console.log(`[tab:create] Tab focused: ${type}`);
        }, 50);
      });

      return { success: true };
    }
  );

  // Handle macOS native "+" tab button - creates a picker tab
  app.on('new-window-for-tab', () => {
    // Get the currently focused window, not just mainWindow
    const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!focusedWindow || focusedWindow.isDestroyed()) return;

    const newTab = createTabWindow('picker');

    // Add as tabbed window immediately (before ready-to-show)
    if (process.platform === 'darwin') {
      focusedWindow.addTabbedWindow(newTab);
    }

    newTab.once('ready-to-show', () => {
      newTab.show();
      // Force focus on the new tab
      newTab.focus();
      newTab.moveTop();
      // Use selectNextTab to ensure it's selected
      if (process.platform === 'darwin') {
        const win = newTab as BrowserWindow & { selectNextTab?: () => void };
        // Force selection by focusing
        newTab.webContents.focus();
      }
    });
  });

  createWindow();

  // Initialize updater after window is created
  initializeUpdater(mainWindow);
  startPeriodicUpdateCheck();

  // Create and set application menu AFTER window is created
  const menu = createApplicationMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  // Ensure workspace directory exists and sync skills (run in background after window creation)
  ensureWorkspaceDir().catch((error) => {
    console.error('Failed to ensure workspace directory:', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      // Update updater window reference
      initializeUpdater(mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
