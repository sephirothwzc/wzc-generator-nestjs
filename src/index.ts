import { init, InitInProp } from './lib/code-generator';
import minimist from 'minimist';
import { exit } from 'process';
import chalk from 'chalk';
import figlet from 'figlet';

/**
 * 启动参数
 */
const findParam = (): InitInProp => {
  const def = process.argv.slice(2);
  if (['helper', '--h', '--helper'].includes(def[0])) {
    console.log(`
--db=<sequelize.config.name[default:development]>
`);
    exit();
  }
  const arg = minimist(process.argv.slice(2));
  const configNodeEnv: string = arg['db'] || 'development';
  return { configNodeEnv };
};

const app = async () => {
  console.log(
    chalk.green(
      figlet.textSync('zhanchao.wu', {
        font: 'Ghost',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      })
    )
  );
  const config = findParam();
  init(config);
};
app();
