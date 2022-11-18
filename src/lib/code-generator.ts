import chalk from 'chalk';
import inquirer from 'inquirer';
import { get, isString } from 'lodash';
import shell from 'shelljs';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { send as entitySend } from './code-template/code-entity';
import { send as typeGraphqlSend } from './code-template/code-type-graphql';
import { send as serviceSend } from './code-template/code-service';
import { send as operationSend } from './code-template/code-operation';
import { send as resolverSend } from './code-template/code-resolver';
import { send as reactGql } from './code-template/code-react-gql';
import { send as reactAntdList } from './code-template/code-react-antd-list';
import { send as reactAntdItem } from './code-template/code-react-antd-item';
import fs from 'fs';
import { promisify } from 'util';
import bluebird from 'bluebird';

// #region interface
export interface ISend {
  columnList: Array<IQueryColumnOut>;
  tableItem: IQueryTableOut;
  keyColumnList: Array<IQueryKeyColumnOut>;
}

export interface InitInProp {
  configNodeEnv: string;
}

export interface ISequelizeConfig {
  port: number;
  host: string;
  database: string;
  username: string;
  password: string;
  dialect: any;
}

export interface IQueryTableOut {
  tableName: string;
  tableComment: string;
  tableType: string;
}

export interface IQueryKeyColumnOut {
  /**
   * 拥有者
   */
  tableSchema: string;
  /**
   * 父表名称
   */
  referencedTableName: string;
  /**
   * 父表字段
   */
  referencedColumnName: string;
  /**
   * 子表名称
   */
  tableName: string;
  /**
   * 子表字段
   */
  columnName: string;
  /**
   * 约束名
   */
  constraintName: string;
  /**
   * 表注释
   */
  tableComment: string;
  /**
   * 约束更新规则
   */
  updateRule: string;
  /**
   * 约束删除规则
   */
  deleteRule: string;
}

export interface IQueryColumnOut {
  tableName: string;
  columnName: string;
  columnComment: string;
  columnType: string;
  dataType: string;
  characterMaximumLength: string;
  isNullable: string;
}

export interface IFileObject {
  /**
   * 第三方方法调用
   */
  fun: ({
    columnList,
    tableItem,
    keyColumnList,
  }: {
    columnList: Array<IQueryColumnOut>;
    tableItem: IQueryTableOut;
    keyColumnList: Array<IQueryKeyColumnOut>;
  }) => Promise<string>;
  /**
   * 自定义文件扩展方法
   */
  path: string | ((tableName: string) => string);
  /**
   * 后缀
   */
  suffix?: string;
  /**
   * 扩展名
   */
  extension?: string;
  /**
   * 文件名 默认 表名tableName.replace(/_/g, '-')
   */
  fileName?: string | ((tableName: string) => string);
}
// #endregion

let sequelize: Sequelize;

/**
 * 获取链接
 * @param config
 * @returns
 */
const getConn = (config: ISequelizeConfig): Sequelize => {
  !sequelize && (sequelize = new Sequelize(config));
  return sequelize;
};

/**
 * 生成类型
 */
const codeTypeArray = [
  'entity',
  'typeGraphql',
  'operation',
  'resolver',
  'service',
  'gql-react',
  'react-antd-list',
  'react-antd-item',
];

/**
 * 生成对象
 */
const allFun = {
  entity: {
    fun: entitySend,
    /**
     * 路径
     */
    path: `./src/lib/model`,
    /**
     * 前缀
     */
    suffix: `entity`,
    /**
     * 扩展名 可以为空默认 ts
     */
    extension: 'ts',
  },
  typeGraphql: {
    fun: typeGraphqlSend,
    path: (tableName: string) => {
      const fileName = tableName.replace(/_/g, '-');
      return `./src/graphql/${fileName}`;
    },
    suffix: 'gql',
  },
  service: {
    fun: serviceSend,
    path: `./src/service`,
    suffix: 'service',
  },
  operation: {
    fun: operationSend,
    path: (tableName: string) => {
      const fileName = tableName.replace(/_/g, '-');
      return `./src/graphql/${fileName}`;
    },
    extension: 'gql',
    fileName: 'operation',
  },
  resolver: {
    fun: resolverSend,
    path: `./src/resolver`,
    suffix: 'resolver',
  },
  'gql-react': {
    fun: reactGql,
    path: (tableName: string) => {
      const fileName = tableName.replace(/_/g, '-');
      return `./src/graphql/${fileName}`;
    },
    extension: 'gql',
    fileName: 'operation',
  },
  'react-antd-list': {
    fun: reactAntdList,
    path: (tableName: string) => {
      const fileName = tableName.replace(/_/g, '-');
      return `./src/views/${fileName}`;
    },
    extension: 'tsx',
    fileName: 'list',
  },
  'react-antd-item': {
    fun: reactAntdItem,
    path: (tableName: string) => {
      const fileName = tableName.replace(/_/g, '-');
      return `./src/views/${fileName}`;
    },
    extension: 'tsx',
    fileName: 'item',
  },
};

/**
 * 加载配置信息
 * @param env 默认配置
 * @returns
 */
const envConfig = (env: string): ISequelizeConfig => {
  // 判断是否midway config存在
  const configPath = './database/config.json';
  try {
    const dbConfig = shell.cat(configPath);
    const result = JSON.parse(dbConfig);
    return get(result, env);
  } catch (error) {
    console.error(
      chalk.white.bgRed.bold(`Error: `) + `\t [${configPath}] not find,must have local umzug!`
    );
    process.exit(1);
  }
};

/**
 * 确认配置
 */
const confirmDBConfig = async (database: string) => {
  const questions = [
    {
      name: 'dbRest',
      type: 'confirm',
      message: `是否采用[${database}]设置`,
      default: 'Y',
    },
  ];
  const value = await inquirer.prompt<any>(questions);

  !value.dbRest && process.exit(1);
};

/**
 * sql 获取所有的表和视图
 * @param config
 */
const queryTable = async (config: ISequelizeConfig) => {
  const sequelize = getConn(config);
  const result = await sequelize.query<IQueryTableOut>(
    `select table_name AS tableName,table_comment AS tableComment,table_type AS tableType
     from information_schema.tables where table_name <> 'sequelizemeta' 
     and table_schema=:database order by table_name`,
    {
      replacements: {
        database: config.database,
      },
      type: QueryTypes.SELECT,
    }
  );
  const tableList = result.map((p) => ({
    name: `${p.tableName}--${p.tableComment}`,
    value: p,
  }));
  return tableList;
};

/**
 * 文件写入
 * @param table
 * @param types
 */
const fileSend = async (tables: [IQueryTableOut], types: [string], config: ISequelizeConfig) => {
  // 循环table选择
  tables &&
    types &&
    (await bluebird.each(tables, async (p) => {
      // 获取columns
      const columnList = await queryColumn(config, p.tableName);

      const keyColumnList = await queryKeyColumn(config, p.tableName);

      await bluebird.each(types, async (x) => {
        // 生成文件
        const fileObj: IFileObject = await get(allFun, x);
        const codeStr = await fileObj.fun({ columnList, tableItem: p, keyColumnList });
        codeStr && (await createFile(fileObj, p.tableName, codeStr, x));
      });
    }));
};

/**
 * 创建文件
 * @param {string}  文件名
 */
const createFile = async (
  fileObj: IFileObject,
  tableName: string,
  txt: string,
  type: string
): Promise<void> => {
  if (!txt) {
    return;
  }
  // 文件名
  const fileName = tableName.replace(/_/g, '-');

  const objath = get(fileObj, 'path', `./out/${type}`);
  const filePath = isString(objath) ? objath : objath(tableName);
  console.log(filePath);
  shell.mkdir('-p', filePath);
  // 最终文件名处理
  const lastFileName = get(fileObj, 'fileName', fileName);
  const overFileName = isString(lastFileName) ? lastFileName : lastFileName(tableName);
  // 文件属性后缀
  const overSuffix = fileObj?.suffix || '';
  // 后缀
  const overExtension = fileObj.extension || 'ts';
  // 完整路径
  const fullPath = `${filePath}/${overFileName}.${overSuffix}.${overExtension}`.replace(
    /\.\./g,
    '.'
  );

  await fileWritePromise(fullPath, txt)
    ?.then(() => {
      success(fullPath);
    })
    .catch((error) => {
      console.error(chalk.white.bgRed.bold(`Error: `) + `\t [${overFileName}]${error}!`);
    });
};

/**
 * 成功提示
 * @param {string} fullPath 文件路径
 */
const success = (fullPath: string) => {
  // 格式化
  // exec(`npx prettier --write ${fullPath}`);
  //
  console.log(chalk.white.bgGreen.bold(`Done! File FullPath`) + `\t [${fullPath}]`);
  shell.exec(`npx prettier --write ${fullPath}`);
};

const fileWritePromise = (fullPath: string, txt: string) => {
  if (!txt) {
    return;
  }

  const fsWriteFile = promisify(fs.writeFile);
  return fsWriteFile(fullPath, txt);
};

export const init = async (config: InitInProp) => {
  const db = envConfig(config.configNodeEnv);
  await confirmDBConfig(db.database);
  const tableList = await queryTable(db);
  // 选择导出表格
  const tables: any = await askListQuestions(tableList, 'tableName', 'checkbox');
  // 选择导出对象
  const types: any = await askListQuestions(codeTypeArray, 'fileType', 'checkbox');

  await fileSend(tables.tableName as any, types.fileType as any, db);

  console.log(chalk.white.bgGreen.bold(`success!`));
  process.exit();
};

/**
 * 询问选中list
 * @param list
 * @param key
 * @param type
 * @param message
 * @returns
 */
const askListQuestions = (list: any[], key: string, type = 'list', message = key) => {
  const questions = [
    {
      name: key,
      type,
      message: message,
      choices: list,
    },
  ];
  return inquirer.prompt(questions);
};

const queryColumn = async (
  config: ISequelizeConfig,
  name: string
): Promise<Array<IQueryColumnOut>> => {
  const sql = `SELECT table_name as tableName,column_name as columnName,
COLUMN_COMMENT as columnComment,column_type as columnType,
DATA_TYPE as dataType, CHARACTER_MAXIMUM_LENGTH as characterMaximumLength,
is_Nullable as isNullable
 FROM information_schema.columns 
  WHERE table_schema=:database AND table_name=:name 
  order by COLUMN_NAME`;
  const sequelize = getConn(config);

  const result = await sequelize.query<IQueryColumnOut>(sql, {
    replacements: {
      database: config.database,
      name,
    },
    type: QueryTypes.SELECT,
  });
  return result || [];
};

const queryKeyColumn = async (
  config: ISequelizeConfig,
  name: string
): Promise<Array<IQueryKeyColumnOut>> => {
  const sql = `SELECT C.TABLE_SCHEMA as tableSchema,
           C.REFERENCED_TABLE_NAME as referencedTableName,
           C.REFERENCED_COLUMN_NAME as referencedColumnName,
           C.TABLE_NAME as tableName,
           C.COLUMN_NAME as columnName,
           C.CONSTRAINT_NAME as constraintName,
           T.TABLE_COMMENT as tableComment,
           R.UPDATE_RULE as updateRule,
           R.DELETE_RULE as deleteRule
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE C
      JOIN INFORMATION_SCHEMA. TABLES T
        ON T.TABLE_NAME = C.TABLE_NAME
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS R
        ON R.TABLE_NAME = C.TABLE_NAME
       AND R.CONSTRAINT_NAME = C.CONSTRAINT_NAME
       AND R.REFERENCED_TABLE_NAME = C.REFERENCED_TABLE_NAME
      WHERE C.REFERENCED_TABLE_NAME IS NOT NULL 
				AND (C.REFERENCED_TABLE_NAME = :tableName or C.TABLE_NAME = :tableName)
        AND C.TABLE_SCHEMA = :database
        group by C.CONSTRAINT_NAME order by C.CONSTRAINT_NAME`;
  const sequelize = getConn(config);
  const result = await sequelize.query<IQueryKeyColumnOut>(sql, {
    replacements: {
      database: config.database,
      tableName: name,
    },
    type: QueryTypes.SELECT,
  });
  return result || [];
};
