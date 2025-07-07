import fs from 'fs';
import path from 'path';
import os from 'os';
import { Logger } from '../utils/logger';
import { FileSystemHelper } from '../utils/file-system-helper';
import { IRecentProjectProvider, RecentProject } from './recent-project-provider';

const logger = new Logger('VSCodeService');

export class VSCodeService implements IRecentProjectProvider {
    public readonly id = 'vscode';

    public async getRecentProjects(): Promise<RecentProject[]> {
        try {
            const storagePath = await this.findStoragePath();
            if (!storagePath) {
                logger.error('[VSCode] 未找到存储文件');
                return [];
            }

            if (storagePath.endsWith('.json')) {
                let projects = await this.parseJsonStorage(storagePath);
                // 过滤和规范化路径
                const IGNORED_DIRS = ['.git', '.devcontainer', '.vscode'];
                projects = projects.map(p => {
                    let normalized = p.path;
                    for (const ignore of IGNORED_DIRS) {
                        if (normalized.endsWith('/' + ignore) || normalized.endsWith('\\' + ignore)) {
                            normalized = normalized.replace(new RegExp(`[\\/]${ignore}$`), '');
                        }
                    }
                    return { ...p, path: normalized, source: 'vscode' };
                });
                // 去重
                const unique = Array.from(new Map(projects.map(p => [p.path, p])).values());
                return unique;
            }

            logger.debug(`[VSCode] 检测到不受支持的存储文件格式: ${storagePath}`);
            return [];
        } catch (error) {
            logger.error('[VSCode] 获取最近项目列表失败:', error);
            return [];
        }
    }

    private uriToPath(uriString: string): string | null {
        if (!uriString) return null;
        try {
            const decodedUri = decodeURIComponent(uriString);
            if (decodedUri.startsWith('file:///')) {
                let fsPath = decodedUri.substring(7);
                // Handle Windows path: /C:/Users/... -> C:/Users/...
                if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(fsPath)) {
                    fsPath = fsPath.substring(1);
                }
                return fsPath;
            }
            if (decodedUri.startsWith('vscode-remote://')) {
                // The `code --folder-uri` command handles this
                return decodedUri;
            }
            if (decodedUri.startsWith('/')) {
                return decodedUri;
            }
            return null;
        } catch (e) {
            logger.error(`URI解析失败: ${uriString}`, e);
            return null;
        }
    }

    private async parseJsonStorage(filePath: string): Promise<RecentProject[]> {
        try {
            const content = await FileSystemHelper.readFile(filePath);
            const data = JSON.parse(content);
            let projects: RecentProject[] = [];

            // Primary Method: lastKnownMenubarData
            const fileMenu = data.lastKnownMenubarData?.menus?.File;
            if (fileMenu?.items) {
                const recentMenu = fileMenu.items.find((item: any) => item.id === 'submenuitem.MenubarRecentMenu');
                if (recentMenu?.submenu?.items) {
                    for (const item of recentMenu.submenu.items) {
                        if (item.id === 'openRecentFolder' && item.uri && item.label) {
                            const projectPath = item.uri.scheme === 'file' ? item.uri.path : item.uri.external;
                            if (projectPath) {
                                projects.push({ name: item.label, path: projectPath, source: 'vscode' });
                            }
                        }
                    }
                }
            }

            if (projects.length > 0) {
                logger.debug(`[VSCode] 通过解析 MenubarData 成功提取了 ${projects.length} 个项目`);
                // The list from menubar should be unique already.
                return Array.from(new Map(projects.map(p => [p.path, p])).values());
            }

            // Fallback Method: backupWorkspaces
            logger.debug('[VSCode] MenubarData 解析失败或为空，尝试使用 backupWorkspaces 作为备用方案');
            const backupFolders = data.backupWorkspaces?.folders;
            if (backupFolders && Array.isArray(backupFolders)) {
                for (const entry of backupFolders) {
                    if (entry.folderUri) {
                        const projectPath = this.uriToPath(entry.folderUri);
                        if (projectPath) {
                            projects.push({
                                name: path.basename(projectPath),
                                path: projectPath,
                                source: 'vscode'
                            });
                        }
                    }
                }
            }

            if (projects.length > 0) {
                logger.debug(`[VSCode] 通过解析 backupWorkspaces 成功提取了 ${projects.length} 个项目`);
                return Array.from(new Map(projects.map(p => [p.path, p])).values());
            }

            logger.info(`[VSCode] 在 ${filePath} 中未能找到任何有效的项目列表结构。`);
            return [];

        } catch (error) {
            logger.error(`[VSCode] 解析 storage.json失败: ${filePath}`, error);
            return [];
        }
    }

    private cleanPath(uri: string): string {
        let cleanPath = uri;
        if (cleanPath.startsWith('file://')) {
            cleanPath = cleanPath.substring(7);
        }
        try {
            return decodeURIComponent(cleanPath);
        } catch (e) {
            logger.error('[VSCode] 解码路径失败:', e);
            return cleanPath;
        }
    }

    private async findStoragePath(): Promise<string | null> {
        const home = os.homedir();
        let possiblePaths: string[] = [];

        const platform = process.platform;
        if (platform === 'darwin') {
            const appSupport = path.join(home, 'Library/Application Support');
            possiblePaths = [
                // New, more specific paths first
                path.join(appSupport, 'Code/User/globalStorage/storage.json'),
                path.join(appSupport, 'Code - Insiders/User/globalStorage/storage.json'),
                path.join(appSupport, 'VSCodium/User/globalStorage/storage.json'),
                // Stable
                path.join(appSupport, 'Code/storage.json'),
                path.join(appSupport, 'Code/User/storage.json'), // Another possible location
                // Insiders
                path.join(appSupport, 'Code - Insiders/storage.json'),
                path.join(appSupport, 'Code - Insiders/User/storage.json'),
                // VSCodium
                path.join(appSupport, 'VSCodium/storage.json'),
                path.join(appSupport, 'VSCodium/User/storage.json'),
                // Also check for Cursor, as it's a popular fork
                path.join(appSupport, 'Cursor/User/globalStorage/storage.json'),
            ];
        } else if (platform === 'win32') {
            const appData = process.env.APPDATA;
            if (appData) {
                possiblePaths = [
                    // New, more specific paths first
                    path.join(appData, 'Code/User/globalStorage/storage.json'),
                    path.join(appData, 'Code - Insiders/User/globalStorage/storage.json'),
                    // Stable
                    path.join(appData, 'Code/storage.json'),
                    path.join(appData, 'Code/User/storage.json'),
                    // Insiders
                    path.join(appData, 'Code - Insiders/storage.json'),
                    path.join(appData, 'Code - Insiders/User/storage.json'),
                ];
            }
        } else if (platform === 'linux') {
            const config = path.join(home, '.config');
            possiblePaths = [
                // New, more specific paths first
                path.join(config, 'Code/User/globalStorage/storage.json'),
                path.join(config, 'Code - Insiders/User/globalStorage/storage.json'),
                path.join(config, 'VSCodium/User/globalStorage/storage.json'),
                // Stable
                path.join(config, 'Code/storage.json'),
                path.join(config, 'Code/User/storage.json'),
                // Insiders
                path.join(config, 'Code - Insiders/storage.json'),
                path.join(config, 'Code - Insiders/User/storage.json'),
                // VSCodium
                path.join(config, 'VSCodium/storage.json'),
                path.join(config, 'VSCodium/User/storage.json'),
            ];
        }

        for (const filePath of possiblePaths) {
            try {
                await fs.promises.access(filePath);
                logger.debug(`[VSCode] 找到存储文件: ${filePath}`);
                return filePath;
            } catch {
                // File does not exist, continue to the next path
            }
        }

        return null;
    }
} 