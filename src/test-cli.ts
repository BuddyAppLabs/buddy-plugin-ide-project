import { ProjectHistoryManager } from './history-manager';
import { RecentProject } from './providers/recent-project-provider';
import { Logger } from './utils/logger';

const logger = new Logger('TestCLI');

/**
 * CLI testing entry point.
 * Usage: pnpm test:cli <keyword>
 */
async function run() {
    const query = process.argv[2];

    if (!query) {
        logger.error('Please provide a keyword as an argument.');
        logger.info('Usage: pnpm test:cli <keyword>');
        return;
    }

    logger.info(`Searching for projects with keyword: "${query}"...`);

    try {
        const manager = new ProjectHistoryManager();
        const recentProjects: RecentProject[] = await manager.getRecentProjects();

        if (recentProjects.length === 0) {
            logger.info('Could not retrieve any recent project history from VSCode.');
            return;
        }

        const filteredProjects = recentProjects.filter((project: RecentProject) =>
            project.name.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredProjects.length === 0) {
            logger.info('No matching projects found.');
        } else {
            console.log('\nFound matching projects:');
            console.log('---------------------------------');
            filteredProjects.forEach((project: RecentProject) => {
                console.log(`  Name: ${project.name}`);
                console.log(`  Path: ${project.path}`);
                console.log(`  Source: ${project.source}`);
                console.log('---------------------------------');
            });
        }
    } catch (error) {
        logger.error('An error occurred during the test:', error);
    }
}

run();
