import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { Logger } from './logger';

const execAsync = promisify(exec);
const logger = new Logger('FileSystemHelper');

/**
 * 文件系统工具类
 * 用于处理文件系统相关的操作
 */
export class FileSystemHelper {
    /**
     * 检查路径是否存在
     * @param path 路径
     * @returns 是否存在
     */
    static async pathExists(path: string): Promise<boolean> {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 读取文件内容
     * @param path 文件路径
     * @returns 文件内容
     */
    static async readFile(path: string): Promise<string> {
        try {
            return await fs.readFile(path, 'utf-8');
        } catch (error: any) {
            logger.error(`读取文件失败: ${path}`, error);
            throw new Error(`读取文件失败: ${error.message}`);
        }
    }

    /**
     * 在系统文件浏览器中打开指定路径
     * @param path 要打开的路径
     * @returns 执行结果消息
     */
    static async openInExplorer(path: string): Promise<string> {
        try {
            let command = '';
            // 根据操作系统选择合适的命令
            if (process.platform === 'darwin') {
                command = `open "${path}"`;
            } else if (process.platform === 'win32') {
                command = `explorer "${path}"`;
            } else if (process.platform === 'linux') {
                command = `xdg-open "${path}"`;
            } else {
                return `不支持的操作系统: ${process.platform}`;
            }

            await execAsync(command);
            return `已在文件浏览器中打开: ${path}`;
        } catch (error: any) {
            logger.error('打开文件浏览器失败:', error);
            throw new Error(`打开文件浏览器失败: ${error.message}`);
        }
    }

    /**
     * 在指定的IDE中打开项目路径
     * @param projectPath 项目路径
     * @param ide 'vscode' | 'cursor' | 'xcode'
     */
    static async openInIDE(projectPath: string, ide: 'vscode' | 'cursor' | 'xcode'): Promise<void> {
        let command = '';
        switch (ide) {
            case 'vscode':
                if (process.platform === 'darwin') {
                    command = `open -a "Visual Studio Code" "${projectPath}"`;
                } else {
                    command = `code "${projectPath}"`;
                }
                break;
            case 'cursor':
                if (process.platform === 'darwin') {
                    command = `open -a "Cursor" "${projectPath}"`;
                } else {
                    throw new Error('Cursor 仅支持 macOS');
                }
                break;
            case 'xcode':
                if (process.platform === 'darwin') {
                    command = `open -a "Xcode" "${projectPath}"`;
                } else {
                    throw new Error('Xcode 仅支持 macOS');
                }
                break;
            default:
                throw new Error(`Unsupported IDE for opening project: ${ide}`);
        }

        try {
            logger.info(`Executing: ${command}`);
            await execAsync(command);
        } catch (error) {
            logger.error(`Failed to execute command: ${command}`, error);
            throw error;
        }
    }
} 