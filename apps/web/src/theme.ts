import type { ThemeConfig } from 'antd';

export const MAU = {
  chinh: '#1677ff',
  chinhDam: '#0958d9',
  nhan: '#f59e0b',
  nen: '#f3f6f8',
};

export const theme: ThemeConfig = {
  token: {
    colorPrimary: MAU.chinh,
    colorInfo: MAU.chinh,
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    colorBgLayout: MAU.nen,
    borderRadius: 10,
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: 14,
    controlHeight: 36,
  },
  components: {
    Layout: { siderBg: 'transparent', headerBg: 'rgba(255,255,255,0.8)', headerHeight: 64, headerPadding: '0 24px' },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(255,255,255,0.14)',
      darkItemHoverBg: 'rgba(255,255,255,0.08)',
      darkItemColor: 'rgba(255,255,255,0.72)',
      itemBorderRadius: 10,
      itemHeight: 44,
    },
    Card: { borderRadiusLG: 16 },
    Table: { headerBg: '#f0f5f6', headerColor: '#36505a', rowHoverBg: '#f2fafa' },
    Button: { fontWeight: 500 },
    Tabs: { titleFontSize: 15 },
  },
};
