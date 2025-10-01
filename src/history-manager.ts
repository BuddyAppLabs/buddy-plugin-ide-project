import { IRecentProjectProvider, RecentProject } from './providers/recent-project-provider';
import { VSCodeService } from './providers/vscode-service';
import { CursorService } from './providers/cursor-service';
import { KiroService } from './providers/kiro-service';
import { QoderService } from './providers/qoder-service';
import os from 'os';

export class ProjectHistoryManager {
    private providers: IRecentProjectProvider[];

    constructor() {
        this.providers = [
            new VSCodeService(),
            new CursorService(),
            new KiroService(),
            new QoderService(),
        ];
    }

    async getRecentProjects(): Promise<RecentProject[]> {
        const all = await Promise.all(this.providers.map(p => p.getRecentProjects()));
        // 合并、归一化路径、去重（以 path 唯一）
        const IGNORED_DIRS = ['.git', '.devcontainer', '.vscode'];
        const map = new Map<string, RecentProject>();
        for (const list of all) {
            for (const p of list) {
                let normalized = p.path;
                for (const ignore of IGNORED_DIRS) {
                    if (normalized.endsWith('/' + ignore) || normalized.endsWith('\\' + ignore)) {
                        normalized = normalized.replace(new RegExp(`[\\\\/]${ignore}$`), '');
                    }
                }
                // 归一化 name
                let displayName = normalized;
                const home = os.homedir();
                if (displayName.startsWith(home)) {
                    displayName = '~' + displayName.substring(home.length);
                }
                // 只用 path 作为 key，完全去重
                map.set(normalized, { ...p, path: normalized, name: displayName });
            }
        }
        return Array.from(map.values());
    }
} 