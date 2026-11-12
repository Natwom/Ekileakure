import client from './client'

export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  me: () => client.get('/auth/me'),
}

export const dashboardApi = { summary: () => client.get('/dashboard/summary') }

export const inventoryApi = {
  products: (params) => client.get('/inventory/products', { params }),
  categories: () => client.get('/inventory/categories'),
  create: (data) => client.post('/inventory/products', data),
  update: (id, data) => client.put(`/inventory/products/${id}`, data),
  adjust: (data) => client.post('/inventory/stock-adjust', data),
  valuation: () => client.get('/inventory/valuation'),
}

export const salesApi = {
  create: (data) => client.post('/sales', data),
  list: (params) => client.get('/sales', { params }),
  ret: (id) => client.post(`/sales/${id}/return`),
}

export const purchasingApi = {
  suppliers: () => client.get('/purchasing/suppliers'),
  createSupplier: (data) => client.post('/purchasing/suppliers', data),
  pay: (id, amount) => client.post(`/purchasing/suppliers/${id}/pay`, { amount }),
  list: () => client.get('/purchasing'),
  create: (data) => client.post('/purchasing', data),
  balances: () => client.get('/purchasing/supplier-balances'),
}

export const mpesaApi = {
  transactions: (params) => client.get('/mpesa/transactions', { params }),
  record: (data) => client.post('/mpesa/transactions', data),
  reverse: (id, reason) => client.post(`/mpesa/transactions/${id}/reverse`, null, { params: { reason } }),
  state: () => client.get('/mpesa/state'),
  closeDay: (data) => client.post('/mpesa/close-day', data),
  reconciliation: () => client.get('/mpesa/reconciliation'),
  setupCapital: (data) => client.post('/mpesa/capital', data),
  reopenDay: (reason) => client.post('/mpesa/reopen-day', null, { params: { reason } }),
}

export const financeApi = {
  expenses: (params) => client.get('/finance/expenses', { params }),
  createExpense: (data) => client.post('/finance/expenses', data),
  deleteExpense: (id) => client.delete(`/finance/expenses/${id}`),
}

export const reportsApi = {
  profitLoss: (from, to) => client.get('/reports/profit-loss', { params: { from_date: from, to_date: to } }),
  exportSales: (from, to) => client.get('/reports/export/sales', { params: { from_date: from, to_date: to }, responseType: 'blob' }),
}

export const usersApi = {
  list: () => client.get('/users'),
  create: (data) => client.post('/users', data),
  update: (id, data) => client.put(`/users/${id}`, data),
}