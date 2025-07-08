
import { FileSystemHelper } from './utils/file-system-helper';
import fs from 'fs';
import { ProjectHistoryManager } from './history-manager';
import { ActionResult, SuperAction, SuperContext, SuperPlugin } from '@coffic/buddy-it';

const ACTION_ID_PREFIX = 'open-project-';
const historyManager = new ProjectHistoryManager();

// 检查目录下是否有 Xcode 工程文件
async function hasXcodeProject(projectPath: string): Promise<boolean> {
	try {
		const files = await fs.promises.readdir(projectPath);
		return files.some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
	} catch {
		return false;
	}
}

export const plugin: SuperPlugin = {
	id: 'project-launcher',
	name: '@coffic/buddy-plugin-project-launcher',
	description: 'Buddy 插件 - 通过关键词快速打开IDE项目',
	author: 'Coffic',
	version: '1.0.0',
	path: '',
	type: 'user',

	async getActions(context: SuperContext): Promise<SuperAction[]> {
		if (!context.keyword) {
			return [];
		}

		const query = context.keyword?.toLowerCase() || '';
		const recentProjects = await historyManager.getRecentProjects();
		const filteredProjects = recentProjects.filter(project =>
			project.name.toLowerCase().includes(query) || project.path.toLowerCase().includes(query)
		);
		const actions: SuperAction[] = [];
		for (const project of filteredProjects) {
			// VSCode
			actions.push({
				id: `${ACTION_ID_PREFIX}${encodeURIComponent(project.path)}-vscode`,
				description: `${project.name}（用 VSCode 打开）`,
			});
			// Cursor
			actions.push({
				id: `${ACTION_ID_PREFIX}${encodeURIComponent(project.path)}-cursor`,
				description: `${project.name}（用 Cursor 打开）`,
			});
			// Xcode（仅当有工程文件时）
			if (await hasXcodeProject(project.path)) {
				actions.push({
					id: `${ACTION_ID_PREFIX}${encodeURIComponent(project.path)}-xcode`,
					description: `${project.name}（用 Xcode 打开）`,
				});
			}
		}
		return actions;
	},

	async executeAction(context: SuperContext): Promise<ActionResult> {
		if (!context.actionId.startsWith(ACTION_ID_PREFIX)) {
			return { success: false, message: 'Unknown action ID.' };
		}
		// 解析 actionId: open-project-<path>-<ide>
		const idBody = context.actionId.substring(ACTION_ID_PREFIX.length);
		const lastDash = idBody.lastIndexOf('-');
		if (lastDash === -1) {
			return { success: false, message: 'Action ID 格式错误' };
		}
		const encodedPath = idBody.substring(0, lastDash);
		const ide = idBody.substring(lastDash + 1);
		const projectPath = decodeURIComponent(encodedPath);
		try {
			await FileSystemHelper.openInIDE(projectPath, ide as any);
			return { success: true, message: `已用${ide}打开：${projectPath}` };
		} catch (e: any) {
			return { success: false, message: e?.message || String(e) };
		}
	},
};