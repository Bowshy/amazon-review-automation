export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: any) => string;
  align?: 'left' | 'center' | 'right';
  actions?: (row: any) => DataTableAction[];
}

export interface DataTableAction {
  label: string;
  icon?: string;
  onClick: (row: any) => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
