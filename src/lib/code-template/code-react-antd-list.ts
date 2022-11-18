import { IQueryColumnOut, ISend } from '../code-generator';
import { camelCase, replace } from 'lodash';
import { pascalCase } from '../utils/helper';

const modelTemplate = ({
  funName,
  className,
  routerName,
  propertyWhere,
  propertyColunm,
}: {
  funName: string;
  className: string;
  routerName: string;
  propertyWhere: string;
  propertyColunm: string;
}) => {
  return `import { FC, ReactNode, useRef } from 'react';
import { Popconfirm, Button, message, Tag, FormInstance } from 'antd';
import { useImmer } from 'use-immer';
import {
  generatorColumns,
  getColumnSearch,
  WhereType,
  filtersToWhere,
  proSortToOrder,
  gqlErrorMessage,
  timeFormatHelper,
  generatorExcelColumns,
} from '../../utils/antd-helper';
import { toString, toInteger, debounce } from 'lodash';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { UseFetchDataAction } from '@ant-design/pro-table/lib/typing';
import { useHistory } from 'react-router';
import { Link } from 'react-router-dom';
import {
  ${className}DestroyMutation,
  ${className}Fragment,
  ${className}Mutation,
  ${className}SaveIn,
  Exact,
} from '../../generator/basics-serialize';
import {
  Find${className}ListDocument,
  use${className}DestroyMutation,
  use${className}Mutation,
  useExport${className}AllQuery,
  useFind${className}ListQuery,
} from '../../generator/basics-serialize.operation';
import { MutationFunctionOptions, FetchResult } from '@apollo/client';
import { format } from 'date-fns';

// #region type
type SetColumnType = { key: keyof ${className}Fragment; [p: string]: any };
type FilterType = {
  [p in keyof ${className}Fragment]?: WhereType;
};
// #endregion

// #region whereModel
const whereModel: FilterType = {
  ${propertyWhere}
};
// #endregion

// #region column
const useColumn = (
  ${funName}Mutatioin: {
    (
      options?: MutationFunctionOptions<
        ${className}Mutation,
        Exact<{ param: ${className}SaveIn }>
      >
    ): Promise<
      FetchResult<${className}Mutation, Record<string, any>, Record<string, any>>
    >;
    (arg0: {
      variables: { param: { id: string; enableFlag: number } };
    }): Promise<any>;
  },
  ${funName}DestroyMutation: {
    (
      options?: MutationFunctionOptions<
        ${className}DestroyMutation,
        Exact<{ id: string }>
      >
    ): Promise<
      FetchResult<
        ${className}DestroyMutation,
        Record<string, any>,
        Record<string, any>
      >
    >;
    (arg0: { variables: { id: string } }): Promise<any>;
  }
) => {
  return generatorColumns<${className}Fragment>(
    Find${className}ListDocument,
    [
      ${propertyColunm}
      {
        key: 'enableFlag',
        filters: true, // 列筛选
        onFilter: true, // form筛选
        valueType: 'select',
        filterMultiple: false,
        valueEnum: {
          1: {
            text: '启用',
          },
          0: {
            text: '停用',
          },
        },
        render: (
          text: ReactNode,
          record: ${className}Fragment,
          index: number,
          action: UseFetchDataAction<${className}Fragment>
        ) => (
          <Button
            type="link"
            key={index}
            onClick={debounce(() => {
              ${funName}Mutatioin({
                variables: {
                  param: {
                    id: record.id,
                    enableFlag: record.enableFlag === 1 ? 0 : 1,
                  },
                },
              })
                .then(() => {
                  action.reload();
                  message.success('修改状态成功');
                })
                .catch(message.error);
            }, toInteger(process.env.REACT_APP_ANTD_DEBOUNCE))}
          >
            <Tag color={record.enableFlag ? 'green' : 'geekblue'}>
              {record.enableFlag ? '启用' : '停用'}
            </Tag>
          </Button>
        ),
      },
      {
        key: 'createdAt',
        valueType: 'dateTimeRange',
        render: (text: ReactNode, record: ${className}Fragment) =>
          timeFormatHelper(record.createdAt),
      },
      {
        key: 'createdIdObj',
        dataIndex: ['createdIdObj', 'username'],
        title: '创建人',
        filter: false,
        sorter: false,
      },
      {
        key: 'operation',
        sorter: false,
        valueType: 'option',
        render: (
          text: ReactNode,
          record: ${className}Fragment,
          index: number,
          action: UseFetchDataAction<${className}Fragment>
        ) => (
          <Popconfirm
            title="确定要删除吗?"
            onConfirm={() =>
              ${funName}DestroyMutation({
                variables: { id: toString(record?.id) },
              })
                .then(() => {
                  action.reload();
                  message.success('删除成功!');
                })
                .catch(gqlErrorMessage)
            }
          >
            <Button type="link" size="small">
              删除
            </Button>
          </Popconfirm>
        ),
      },
      {
        key: 'id',
        ...getColumnSearch<${className}Fragment>('id'),
        render: (
          text: ReactNode,
          record: ${className}Fragment,
          index: number,
          action: UseFetchDataAction<${className}Fragment>
        ) => <Link to={\`/${routerName}/\${text}\`}>{text}</Link>,
      },
    ] as SetColumnType[],
    ['createdId']
  ) as ProColumns<${className}Fragment>[];
};
// #endregion

/**
 * 公司管理
 * @returns
 */
const List: FC = () => {
  const history = useHistory();
  const refProTable = useRef<ActionType>();
  /**
   * mutation delete
   */
  const [${funName}DestroyMutation] = use${className}DestroyMutation();

  /**
   * mutation update
   */
  const [${funName}Mutatioin] = use${className}Mutation();

  const columnsDefault = useColumn(${funName}Mutatioin, ${funName}DestroyMutation);
  /**
   * 定义列
   */
  const [columns] = useImmer(columnsDefault);

  /**
   * 分页查询
   */
  const { refetch } = useFind${className}ListQuery({ skip: true });

  // #region 导出excel
  const Export = useExport${className}AllQuery({ skip: true });
  /**
   * 导出excel
   */

  const refProTableForm = useRef<FormInstance>();
  const feedbacksExport = () => {
    const filterValue = refProTableForm.current?.getFieldsValue();
    const where = filtersToWhere([filterValue], whereModel);

    Export.refetch({
      param: {
        where,
      },
      dataRoot: '${className}All',
      columns: [
        { key: 'id', name: 'ID', path: '$.id' },
        ...generatorExcelColumns(columnsDefault),
      ],
      fileName: \`\${format(new Date(), 'yyyyMMdd')}.xls\`,
    });
  };
  // #endregion

  return (
    <ProTable<${className}Fragment>
      columns={columns}
      actionRef={refProTable}
      request={async (params, sorter, filter) =>
        refetch({
          param: {
            limit: params.pageSize,
            offset:
              (toInteger(params.current) - 1) * toInteger(params.pageSize),
            order: proSortToOrder(sorter),
            where: filtersToWhere([params, filter], whereModel),
          },
        }).then((result) => {
          return {
            data: result.data.${funName}All as Array<${className}Fragment>,
            total: toInteger(result.data?.${funName}Count),
            success: true,
          };
        })
      }
      rowKey="id"
      pagination={{
        showQuickJumper: true,
        hideOnSinglePage: true,
      }}
      search={{
        layout: 'vertical',
      }}
      dateFormatter="string"
      toolBarRender={() => [
        <Button
          type="primary"
          key="primary"
          onClick={() => history.push('/${routerName}/')}
        >
          新增
        </Button>,
        <Button type="primary" key="primary" onClick={feedbacksExport}>
          导出
        </Button>,
      ]}
      debounceTime={toInteger(process.env.REACT_APP_ANTD_DEBOUNCE)}
      options={{ density: true }}
    />
  );
};

export default List;
`;
};

const notColumn = [
  'updated_at',
  'deleted_at',
  'created_user',
  'updated_user',
  'updated_id',
  'deleted_id',
  'i18n',
  'business_code',
  'id',
  'version',
];

const itemWhere = (col: IQueryColumnOut) => {
  switch (col.columnType) {
    case 'bigint':
    case 'nvarchar':
    case 'varchar':
      return '_like';
    case 'timestamp':
    case 'int':
    case 'decimal':
    case 'double':
      return `_between`;
    case 'datetime':
      return `_between`;
    case 'boolean':
    case 'tinyint':
      return '_eq';
    case 'json':
      return '_json';
    default:
      return '_like';
  }
};

/**
 * 获取列属性
 * @param columnList
 */
const findPropertyWhere = (columnList: Array<IQueryColumnOut>) => {
  const list = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      return `// ${p.columnComment}
  ${camelCase(p.columnName)}: '${itemWhere(p)}',`;
    });
  return list.join(`
`);
};

/**
 * 列属性
 * @param columnList
 * @returns
 */
const findPropertyCloumn = (columnList: Array<IQueryColumnOut>, className: string) => {
  const list = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      return `{
        key: '${camelCase(p.columnName)}',
        ...getColumnSearch<${className}Fragment>('${camelCase(p.columnName)}'),
        title: '${p.columnComment}',
      },`;
    });
  return list.join(`
`);
};

export const send = ({ tableItem, columnList }: ISend) => {
  return modelTemplate({
    funName: camelCase(tableItem.tableName),
    className: pascalCase(tableItem.tableName),
    routerName: replace(tableItem.tableName, '_', '-'),
    propertyWhere: findPropertyWhere(columnList),
    propertyColunm: findPropertyCloumn(columnList, pascalCase(tableItem.tableName)),
  });
};
