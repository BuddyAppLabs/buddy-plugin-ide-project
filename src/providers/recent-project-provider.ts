export interface RecentProject {
    name: string;
    path: string;
    source: string; // 来源IDE，如 'vscode'、'cursor' 等
}

export interface IRecentProjectProvider {
    getRecentProjects(): Promise<RecentProject[]>;
    readonly id: string;
}
