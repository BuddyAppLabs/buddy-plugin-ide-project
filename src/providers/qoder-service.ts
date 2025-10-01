import { IRecentProjectProvider, RecentProject } from './recent-project-provider';
import { FileSystemHelper } from '../utils/file-system-helper';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Logger } from '../utils/logger';

const logger = new Logger('QoderService');

export class QoderService implements IRecentProjectProvider {
    public readonly id = 'qoder';

    private async findStoragePath(): Promise<string | null> {
        const home = os.homedir();
        let possiblePaths: string[] = [];
        if (process.platform === 'darwin') {
            const appSupport = path.join(home, 'Library/Application Support');
            possiblePaths = [
                path.join(appSupport, 'Qoder/User/globalStorage/storage.json'),
                path.join(appSupport, 'Qoder/User/storage.json'),
                path.join(appSupport, 'Qoder/storage.json'),
            ];
        } else if (process.platform === 'linux') {
            possiblePaths = [
                path.join(home, '.config/Qoder/User/globalStorage/storage.json'),
                path.join(home, '.config/Qoder/User/storage.json'),
                path.join(home, '.config/Qoder/storage.json'),
            ];
        } else if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            possiblePaths = [
                path.join(appData, 'Qoder/User/globalStorage/storage.json'),
                path.join(appData, 'Qoder/User/storage.json'),
                path.join(appData, 'Qoder/storage.json'),
            ];
        }
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                logger.debug(`[Qoder] 找到存储文件: ${p}`);
                return p;
            }
        }
        return null;
    }

    public async getRecentProjects(): Promise<RecentProject[]> {
        try {
            const storagePath = await this.findStoragePath();
            if (!storagePath) {
                logger.info('[Qoder] 未找到存储文件');
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
                    return { ...p, path: normalized, source: 'qoder' };
                });
                // 去重
                const unique = Array.from(new Map(projects.map(p => [p.path, p])).values());
                return unique;
            }
            logger.debug(`[Qoder] 检测到不受支持的存储文件格式: ${storagePath}`);
            return [];
        } catch (error) {
            logger.error('[Qoder] 获取最近项目列表失败:', error);
            return [];
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
                                projects.push({ name: item.label, path: projectPath, source: 'qoder' });
                            }
                        }
                    }
                }
            }
            if (projects.length > 0) {
                logger.debug(`[Qoder] 通过解析 MenubarData 成功提取了 ${projects.length} 个项目`);
                return Array.from(new Map(projects.map(p => [p.path, p])).values());
            }
            // Fallback Method: backupWorkspaces
            logger.debug('[Qoder] MenubarData 解析失败或为空，尝试使用 backupWorkspaces 作为备用方案');
            const backupFolders = data.backupWorkspaces?.folders;
            if (backupFolders && Array.isArray(backupFolders)) {
                for (const entry of backupFolders) {
                    if (entry.folderUri) {
                        const projectPath = this.uriToPath(entry.folderUri);
                        if (projectPath) {
                            projects.push({
                                name: path.basename(projectPath),
                                path: projectPath,
                                source: 'qoder',
                            });
                        }
                    }
                }
            }
            if (projects.length > 0) {
                logger.debug(`[Qoder] 通过解析 backupWorkspaces 成功提取了 ${projects.length} 个项目`);
                return Array.from(new Map(projects.map(p => [p.path, p])).values());
            }
            logger.info(`[Qoder] 在 ${filePath} 中未能找到任何有效的项目列表结构。`);
            return [];
        } catch (error) {
            logger.error(`[Qoder] 解析Qoder storage.json失败: ${filePath}`, error);
            return [];
        }
    }

    private uriToPath(uriString: string): string | null {
        if (!uriString) return null;
        try {
            const decodedUri = decodeURIComponent(uriString);
            if (decodedUri.startsWith('file:///')) {
                let fsPath = decodedUri.substring(7);
                if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(fsPath)) {
                    fsPath = fsPath.substring(1);
                }
                return fsPath;
            }
            if (decodedUri.startsWith('vscode-remote://')) {
                return decodedUri;
            }
            if (decodedUri.startsWith('/')) {
                return decodedUri;
            }
            return null;
        } catch (e) {
            logger.error(`[Qoder] URI解析失败: ${uriString}`, e);
            return null;
        }
    }
}