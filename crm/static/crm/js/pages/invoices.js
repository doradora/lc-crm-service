// 發票管理頁面 JavaScript
createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      invoices: [],
      payments: [],
      isLoading: true,
      isSaving: false,
      isExporting: false,
      searchQuery: "",
      paymentStatusFilter: "",
      paymentMethodFilter: "",
      invoiceTypeFilter: "", // 新增發票類型篩選
      startDate: "",
      endDate: "",
      pageSize: 10,
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      activeMenu: null,
      sortField: "issue_date",
      sortOrder: "desc",
      searchTimeout: null,
      // Modal 相關
      isEdit: false,
      validationErrors: {},
      dateErrors: {}, // 新增日期錯誤狀態
      dateWarning: {}, // 新增日期警告狀態
      invoiceForm: {
        id: null,
        invoice_type: "normal", // 新增發票類型
        invoice_number: "",
        payment: "",
        amount: "",
        tax_amount: "",
        issue_date: "",
        payment_received_date: "",
        account_entry_date: "",
        payment_method: "",
        actual_received_amount: "",
        notes: "",
        gross_amount: "", // 含稅金額
        payment_status: "unpaid", // 新的付款狀態
        is_paid: false, // 保留舊欄位以保持相容性
      },
      menuPosition: {
        x: 0,
        y: 0,
      },
    };
  },
  computed: {
    displayedPages() {
      const pages = [];
      const current = this.currentPage;
      const total = this.totalPages;
      const delta = 2;

      for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
        pages.push(i);
      }

      if (current - delta > 2) {
        pages.unshift("...");
        pages.unshift(1);
      } else if (current - delta === 2) {
        pages.unshift(1);
      }

      if (current + delta < total - 1) {
        pages.push("...");
        pages.push(total);
      } else if (current + delta === total - 1) {
        pages.push(total);
      }

      return pages;
    }
  }, mounted() {
    this.fetchInvoices();
    this.fetchPayments();

    // 監聽點擊事件來關閉下拉選單，增強點擊檢測範圍
    document.addEventListener('click', (e) => {
      // 如果點擊的不是操作按鈕或下拉選單內的元素
      if (!e.target.closest('.btn-light') && !e.target.closest('.menu-sub-dropdown')) {
        this.activeMenu = null;
      }
    });

    // 監聽視窗尺寸變化，自動關閉選單
    window.addEventListener('resize', () => {
      this.activeMenu = null;
    });
    
    // 頁面載入後自動focus到搜尋欄位
    this.$nextTick(() => {
      if (this.$refs.searchInput) {
        this.$refs.searchInput.focus();
      }
    });
  },
  methods: {
    async fetchInvoices(page = 1) {
      this.isLoading = true;
      this.currentPage = page;

      try {
        const params = new URLSearchParams({
          page: page,
          page_size: this.pageSize,
          ordering: this.sortOrder === 'asc' ? this.sortField : `-${this.sortField}`
        });

        if (this.searchQuery) {
          params.append('search', this.searchQuery);
        }

        if (this.paymentStatusFilter) {
          params.append('payment_status', this.paymentStatusFilter);
        }

        if (this.paymentMethodFilter) {
          params.append('payment_method', this.paymentMethodFilter);
        }

        if (this.invoiceTypeFilter) {
          params.append('invoice_type', this.invoiceTypeFilter);
        }

        if (this.startDate) {
          params.append('issue_date__gte', this.startDate);
        }

        if (this.endDate) {
          params.append('issue_date__lte', this.endDate);
        }

        const response = await fetch(`/crm/api/invoices/?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        this.invoices = data.results;
        this.totalPages = Math.ceil(data.count / this.pageSize);
        this.totalCount = data.count;

      } catch (error) {
        console.error('Error fetching invoices:', error);
        this.showNotification('載入發票資料時發生錯誤', 'error');
      } finally {
        this.isLoading = false;
      }
    },

    async fetchPayments() {
      try {
        const response = await fetch('/crm/api/payments/?page_size=100');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        this.payments = data.results;
      } catch (error) {
        console.error('Error fetching payments:', error);
      }
    },

    searchInvoices() {
      // 使用防抖來避免頻繁請求
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.fetchInvoices(1);
      }, 500);
    },

    sortBy(field) {
      if (this.sortField === field) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortField = field;
        this.sortOrder = 'asc';
      }
      this.fetchInvoices(1);
    },

    showAddInvoiceModal() {
      this.resetInvoiceForm();
      this.isEdit = false;
      this.validationErrors = {};
      this.invoiceForm.gross_amount = "";
      const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
      modal.show();
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.invoiceNumberInput) {
            this.$refs.invoiceNumberInput.focus();
          }
        });
      }, { once: true });
    },

    editInvoice(invoice) {
      this.isEdit = true;
      this.validationErrors = {};
      this.invoiceForm = {
        id: invoice.id,
        invoice_type: invoice.invoice_type || "normal", // 新增發票類型
        invoice_number: invoice.invoice_number,
        payment: invoice.payment || "",
        amount: invoice.amount,
        tax_amount: invoice.tax_amount,
        issue_date: invoice.issue_date,
        payment_received_date: invoice.payment_received_date || "",
        account_entry_date: invoice.account_entry_date || "",
        payment_method: invoice.payment_method || "",
        actual_received_amount: invoice.actual_received_amount || "",
        notes: invoice.notes || "",
        gross_amount: (Number(invoice.amount || 0) + Number(invoice.tax_amount || 0)),
        payment_status: invoice.payment_status || (invoice.is_paid ? "paid" : "unpaid"), // 新的付款狀態
        is_paid: invoice.is_paid || false, // 保留舊欄位以保持相容性
      };
      const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
      modal.show();
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.invoiceNumberInput) {
            this.$refs.invoiceNumberInput.focus();
          }
        });
      }, { once: true });
      
      this.activeMenu = null;
    },

    validateForm() {
      this.validationErrors = {};

      // 發票類型必填
      if (!this.invoiceForm.invoice_type) {
        this.validationErrors.invoice_type = true;
      }

      // 正常開立發票時的必填欄位
      if (this.invoiceForm.invoice_type === 'normal') {
        if (!this.invoiceForm.invoice_number) {
          this.validationErrors.invoice_number = true;
        }

        if (!this.invoiceForm.amount) {
          this.validationErrors.amount = true;
        }

        if (!this.invoiceForm.tax_amount) {
          this.validationErrors.tax_amount = true;
        }

        if (!this.invoiceForm.issue_date) {
          this.validationErrors.issue_date = true;
        }
      }

      // 請款單必填
      if (!this.invoiceForm.payment) {
        this.validationErrors.payment = true;
      }

      // 收款日和入帳日不需驗證
      // if (this.invoiceForm.invoice_type === 'normal') {
      //   if (!this.invoiceForm.payment_received_date) {
      //     this.validationErrors.payment_received_date = '請填寫正確收款日期';
      //   }

      //   if (!this.invoiceForm.account_entry_date) {
      //     this.validationErrors.account_entry_date = '請填寫正確入帳日期';
      //   }
      // }

      // 重新驗證所有日期
      this.handleDateValidation('issue_date');
      this.handleDateValidation('payment_received_date');
      this.handleDateValidation('account_entry_date');

      return Object.keys(this.validationErrors).length === 0 && Object.keys(this.dateErrors).length === 0;
    },

    async saveInvoice() {
      if (!this.validateForm()) {
        let errorMessage = '請填寫必填欄位';
        if (Object.keys(this.dateErrors).length > 0) {
          errorMessage += '並檢查日期格式';
        }
        this.showNotification(errorMessage, 'error');
        return;
      }
      this.isSaving = true;
      try {
        const formData = { ...this.invoiceForm };
        delete formData.gross_amount; // gross_amount 只是前端計算用，不需要傳送到後端
        
        // 同步 payment_status 到 is_paid 欄位以保持向後相容
        formData.is_paid = (formData.payment_status === 'paid');
        
        Object.keys(formData).forEach(key => {
          if (formData[key] === '') {
            formData[key] = null;
          }
        });
        const url = this.isEdit
          ? `/crm/api/invoices/${this.invoiceForm.id}/`
          : '/crm/api/invoices/';
        const method = this.isEdit ? 'PATCH' : 'POST';
        fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify(formData)
        })
          .then(async response => {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || '操作失敗');
            }
            this.showNotification(this.isEdit ? '發票更新成功！' : '發票新增成功！', 'success');
            this.closeInvoiceModal();
            this.fetchInvoices(this.currentPage);
          })
          .catch(error => {
            console.error('Error saving invoice:', error);
            this.showNotification(error.message || '操作失敗', 'error');
          })
          .finally(() => {
            this.isSaving = false;
          });
      } catch (error) {
        this.isSaving = false;
        this.showNotification(error.message || '操作失敗', 'error');
      }
    },
    async markAsPaid(invoiceId) {
      // 使用 showConfirmDialog 顯示確認對話框
      const confirmed = await this.showConfirmDialog('確定要標記為已付款嗎？');
      if (!confirmed) return;

      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            payment_status: 'paid',
            is_paid: true
          })
        });

        if (!response.ok) throw new Error('操作失敗');

        this.showNotification('已標記為已付款', 'success');
        this.fetchInvoices(this.currentPage);

      } catch (error) {
        console.error('Error marking as paid:', error);
        this.showNotification('操作失敗', 'error');
      }

      this.activeMenu = null;
    },
    
    async markAsUnpaid(invoiceId) {
      // 使用 showConfirmDialog 顯示確認對話框
      const confirmed = await this.showConfirmDialog('確定要標記為未付款嗎？');
      if (!confirmed) return;

      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            payment_status: 'unpaid',
            is_paid: false
          })
        });

        if (!response.ok) throw new Error('操作失敗');

        this.showNotification('已標記為未付款', 'success');
        this.fetchInvoices(this.currentPage);

      } catch (error) {
        console.error('Error marking as unpaid:', error);
        this.showNotification('操作失敗', 'error');
      }

      this.activeMenu = null;
    },
    
    async markAsPartiallyPaid(invoiceId) {
      // 使用 showConfirmDialog 顯示確認對話框
      const confirmed = await this.showConfirmDialog('確定要標記為付款未完成嗎？');
      if (!confirmed) return;

      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            payment_status: 'partially_paid',
            is_paid: false
          })
        });

        if (!response.ok) throw new Error('操作失敗');

        this.showNotification('已標記為付款未完成', 'success');
        this.fetchInvoices(this.currentPage);

      } catch (error) {
        console.error('Error marking as partially paid:', error);
        this.showNotification('操作失敗', 'error');
      }

      this.activeMenu = null;
    },
    async deleteInvoice(invoiceId) {
      // 使用 showConfirmDialog 顯示確認對話框，刪除操作使用危險顏色突出顯示
      const confirmed = await this.showConfirmDialog('確定要刪除這張發票嗎？此操作無法復原。', '確認刪除', 'warning', true);
      if (!confirmed) return;

      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'DELETE',
          headers: {
            'X-CSRFToken': this.getCsrfToken()
          }
        });

        if (!response.ok) throw new Error('刪除失敗');

        this.showNotification('發票刪除成功！', 'success');
        this.fetchInvoices(this.currentPage);

      } catch (error) {
        console.error('Error deleting invoice:', error);
        this.showNotification('刪除失敗', 'error');
      }

      this.activeMenu = null;
    },

    viewPaymentDetails(paymentId) {
      window.location.href = `/crm/payment/${paymentId}/details/`;
    },

    closeInvoiceModal() {
      const modal = bootstrap.Modal.getInstance(document.getElementById('invoiceModal'));
      if (modal) {
        modal.hide();
      }
      // 延遲重置表單，確保Modal完全關閉後再清空
      setTimeout(() => {
        this.resetInvoiceForm();
      }, 300);
    },

    resetInvoiceForm() {
      this.invoiceForm = {
        id: null,
        invoice_type: "normal",
        invoice_number: "",
        payment: "",
        amount: "",
        tax_amount: "",
        issue_date: "",
        payment_received_date: "",
        account_entry_date: "",
        payment_method: "",
        actual_received_amount: "",
        notes: "",
        gross_amount: "",
        payment_status: "unpaid",
        is_paid: false,
      };
      this.validationErrors = {};
      this.dateErrors = {}; // 清空日期錯誤
      this.isEdit = false;
    },

    pageSizeChanged() {
      this.fetchInvoices(1);
    }, 
    toggleMenu(invoiceId) {
      if (this.activeMenu === invoiceId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120, // 向左偏移 120px
          y: rect.bottom + 10, // 向下偏移 10px
        };
        this.activeMenu = invoiceId;
      }
      event.stopPropagation();
    }, 
    getMenuStyle(invoiceId) {
      return {
        display: this.activeMenu === invoiceId ? 'block' : 'none',
        position: 'absolute',
        zIndex: 1000,
        // 根據窗口尺寸動態設置位置
        top: 'auto',
        bottom: '100%',
        right: '0',
        left: 'auto',
        transform: `translateY(${this.menuPosition.y}px)`,
        margin: '0px'
      };
    },

    getPaymentStatusBadgeClass(invoice) {
      // 使用新的 payment_status 欄位，若沒有則使用 is_paid 作為備用
      const status = invoice.payment_status || (invoice.is_paid ? 'paid' : 'unpaid');
      
      switch (status) {
        case 'paid':
          return 'badge badge-success';
        case 'partially_paid':
          return 'badge badge-warning';
        case 'unpaid':
        default:
          return 'badge badge-secondary';
      }
    },

    // 取得付款狀態文字
    getPaymentStatusText(invoice) {
      const status = invoice.payment_status || (invoice.is_paid ? 'paid' : 'unpaid');
      
      switch (status) {
        case 'paid':
          return '已付款';
        case 'partially_paid':
          return '付款未完成';
        case 'unpaid':
        default:
          return '未付款';
      }
    },

    // 取得發票類型文字
    getInvoiceTypeText(type) {
      switch (type) {
        case 'normal':
          return '正常開立';
        case 'no_invoice':
          return '不開發票';
        case 'pending':
          return '發票待開';
        default:
          return '正常開立';
      }
    },

    // 取得發票類型徽章樣式
    getInvoiceTypeBadgeClass(type) {
      switch (type) {
        case 'normal':
          return 'badge-primary';
        case 'no_invoice':
          return 'badge-secondary';
        case 'pending':
          return 'badge-warning';
        default:
          return 'badge-primary';
      }
    },

    getPaymentMethodText(method) {
      const methods = {
        'cash': '現金',
        'bank_transfer': '銀行轉帳',
        'check': '支票',
        'credit_card': '信用卡',
        'other': '其他'
      };
      return methods[method] || method;
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, '/');
    },

    formatCurrency(amount) {
      if (!amount) return '0';
      return parseFloat(amount).toLocaleString("zh-TW");
    },

    getCsrfToken() {
      return document.querySelector('[name=csrfmiddlewaretoken]').value;
    },
      // 顯示通知訊息
    showNotification(message, type = 'info') {
      const options = {
        text: message,
        icon: type,
        buttonsStyling: true,
        confirmButtonText: '確定',
        customClass: {
          confirmButton: 'btn btn-primary'
        }
      };

      // 根據不同的通知類型設置標題
      if (type === 'error') {
        options.title = '錯誤';
      } else if (type === 'success') {
        options.title = '成功';
      } else if (type === 'warning') {
        options.title = '警告';
      } else {
        options.title = '訊息';
      }

      // 顯示 SweetAlert2 通知
      return Swal.fire(options);
    },
    
    // 顯示確認對話框
    async showConfirmDialog(message, title = '確認操作', type = 'question', isDanger = false) {
      const options = {
        title: title,
        text: message,
        icon: type,
        showCancelButton: true,
        confirmButtonText: isDanger ? '確定刪除' : '確定',
        cancelButtonText: '取消',
        buttonsStyling: true,
        customClass: {
          confirmButton: isDanger ? 'btn btn-danger' : 'btn btn-primary',
          cancelButton: 'btn btn-secondary'
        }
      };
      
      if (isDanger) {
        options.confirmButtonColor = '#d33';
      }
      
      const result = await Swal.fire(options);
      return result.isConfirmed;
    },

    // 四捨五入到整數（模擬 Excel ROUND）
    round(value, digits = 0) {
      const factor = Math.pow(10, digits);
      return Math.round(value * factor) / factor;
    },

    // 驗證日期格式和有效性
    validateDateInput(dateString, fieldName) {
      if (!dateString) {
        delete this.dateErrors[fieldName];
        return true;
      }

      // 檢查基本格式 YYYY-MM-DD
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(dateString)) {
        this.dateErrors[fieldName] = '請輸入正確的日期格式 (YYYY-MM-DD)';
        return false;
      }

      // 檢查年份範圍 (1900-2999)
      const year = parseInt(dateString.substr(0, 4));
      if (year < 1900 || year > 2999) {
        this.dateErrors[fieldName] = '年份必須在 1900-2999 之間';
        return false;
      }

      // 檢查是否為有效日期
      const date = new Date(dateString + 'T00:00:00');
      const inputDateStr = dateString;
      const validDateStr = date.getFullYear() + '-' + 
                          String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(date.getDate()).padStart(2, '0');

      if (inputDateStr !== validDateStr || isNaN(date.getTime())) {
        this.dateErrors[fieldName] = '請輸入有效的日期 (例如: 2025-02-31 不是有效日期)';
        return false;
      }

      delete this.dateErrors[fieldName];
      return true;
    },

    // 驗證日期輸入並檢查邏輯關係
    handleDateValidation(fieldName) {
      this.dateWarning[fieldName] = null; // 清除警告訊息
      const value = this.invoiceForm[fieldName];
      
      // 先驗證單個日期格式
      if (!this.validateDateInput(value, fieldName)) {
        return;
      }

      // 如果格式正確，再檢查邏輯關係
      if (fieldName === 'payment_received_date' && value) {
        const paymentDate = new Date(value + 'T00:00:00');
        const issueDate = new Date(this.invoiceForm.issue_date + 'T00:00:00');
        
        if (this.invoiceForm.issue_date && paymentDate < issueDate) {
          this.dateWarning[fieldName] = '收款日期不能早於發票開立日期';
        }
      }

      if (fieldName === 'account_entry_date' && value) {
        const entryDate = new Date(value + 'T00:00:00');
        
        if (this.invoiceForm.payment_received_date) {
          const paymentDate = new Date(this.invoiceForm.payment_received_date + 'T00:00:00');
          if (entryDate < paymentDate) {
            this.dateErrors[fieldName] = '入帳日期不能早於收款日期';
          }
        }
      }
    },    
    
    // 當含稅金額變動時自動計算未稅與稅額
    handleGrossAmountChange() {
      const gross = Number(this.invoiceForm.gross_amount) || 0;
      const amount = this.round(gross / 1.05, 0);
      const tax = gross - amount;
      this.invoiceForm.amount = amount;
      this.invoiceForm.tax_amount = tax;
    },
    // 當未稅金額變動時自動計算稅額
    handleAmountChange() {
      const gross = Number(this.invoiceForm.gross_amount) || 0;
      const amount = Number(this.invoiceForm.amount) || 0;
      const tax = gross - amount;
      this.invoiceForm.tax_amount = tax;
    },
    // 當稅額變動時自動計算未稅金額
    handleTaxAmountChange() {
      const gross = Number(this.invoiceForm.gross_amount) || 0;
      const tax = Number(this.invoiceForm.tax_amount) || 0;
      const amount = gross - tax;
      this.invoiceForm.amount = amount;
    },
    
    // 處理發票類型變更
    handleInvoiceTypeChange() {
      // 當選擇不開發票或發票待開時，設定對應的發票號碼並清空相關欄位
      if (this.invoiceForm.invoice_type === 'no_invoice') {
        this.invoiceForm.invoice_number = "不開發票";
        this.invoiceForm.amount = "";
        this.invoiceForm.tax_amount = "";
        this.invoiceForm.issue_date = "";
        this.invoiceForm.gross_amount = "";
      } else if (this.invoiceForm.invoice_type === 'pending') {
        this.invoiceForm.invoice_number = "發票待開";
        this.invoiceForm.amount = "";
        this.invoiceForm.tax_amount = "";
        this.invoiceForm.issue_date = "";
        this.invoiceForm.gross_amount = "";
      } else if (this.invoiceForm.invoice_type === 'normal') {
        // 如果切換回正常開立，清空發票號碼讓用戶自行輸入
        if (this.invoiceForm.invoice_number === "不開發票" || this.invoiceForm.invoice_number === "發票待開") {
          this.invoiceForm.invoice_number = "";
        }
      }
      
      // 清空驗證錯誤
      this.validationErrors = {};
      this.dateErrors = {};
      this.dateWarning = {};
    },

    /**
     * 匯出發票資料為 EXCEL
     */
    async exportInvoices() {
      try {
        const yearRange = await this.selectYearRange();
        if (yearRange === null) return;
        
        this.isExporting = true;
        
        // 構建匯出 URL，包含當前的篩選條件
        let url = '/crm/export/invoices/csv/';
        const params = new URLSearchParams();
        
        // 添加年份範圍參數
        if (yearRange.year_start) params.append('year_start', yearRange.year_start);
        if (yearRange.year_end) params.append('year_end', yearRange.year_end);
        
        // 添加當前的篩選條件
        if (this.searchQuery) {
          params.append('search', this.searchQuery);
        }
        if (this.paymentStatusFilter) {
          params.append('payment_status', this.paymentStatusFilter);
        }
        if (this.paymentMethodFilter) {
          params.append('payment_method', this.paymentMethodFilter);
        }
        if (this.invoiceTypeFilter) {
          params.append('invoice_type', this.invoiceTypeFilter);
        }
        if (this.startDate) {
          params.append('issue_date__gte', this.startDate);
        }
        if (this.endDate) {
          params.append('issue_date__lte', this.endDate);
        }
        
        if (params.toString()) {
          url += '?' + params.toString();
        }
        
        await this.downloadFile(url);
        this.showSuccessMessage('發票資料匯出成功');
        
      } catch (error) {
        this.showErrorMessage('發票資料匯出失敗', error);
      } finally {
        this.isExporting = false;
      }
    },

    /**
     * 取得年份選項（2000~今年）
     */
    getYearOptions() {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let y = currentYear; y >= 2000; y--) {
        years.push(y);
      }
      return years;
    },

    /**
     * 彈出年份選擇 Swal，回傳 {year_start, year_end} 或 null
     */
    async selectYearRange() {
      const years = this.getYearOptions();
      const yearOptions = years.map(y => `<option value='${y}'>${y}</option>`).join('');
      const { value: formValues } = await Swal.fire({
        title: '選擇匯出年份區間',
        html:
          `<div class='mb-2'>\n` +
          `<label>開始年份</label>\n` +
          `<select id='swal-year-start' class='swal2-input'><option value=''>開始年份</option>${yearOptions}</select>\n` +
          `</div>\n` +
          `<div class='mb-2'>\n` +
          `<label>結束年份</label>\n` +
          `<select id='swal-year-end' class='swal2-input'><option value=''>結束年份</option>${yearOptions}</select>\n` +
          `</div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '匯出',
        cancelButtonText: '取消',
        preConfirm: () => {
          const year_start = document.getElementById('swal-year-start').value;
          const year_end = document.getElementById('swal-year-end').value;
          if (year_start && year_end && parseInt(year_start) > parseInt(year_end)) {
            Swal.showValidationMessage('開始年份不能大於結束年份');
            return false;
          }
          return { year_start, year_end };
        }
      });
      if (!formValues) return null;
      if (!formValues.year_start && !formValues.year_end) return {}; // 全部
      return formValues;
    },

    /**
     * 下載檔案的通用方法
     */
    async downloadFile(url) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-CSRFToken': this.getCsrfToken(),
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 取得檔案名稱（如果有的話）
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
        
        if (contentDisposition) {
          // 首先嘗試解析 UTF-8 編碼的檔案名稱
          const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
          if (utf8Match) {
            try {
              filename = decodeURIComponent(utf8Match[1]);
            } catch (e) {
              console.warn('Failed to decode UTF-8 filename:', e);
            }
          } else {
            // 如果沒有 UTF-8 編碼，則使用標準的 filename
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }
        }

        const blob = await response.blob();
        
        // 創建下載連結
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        return response;
      } catch (error) {
        console.error('Download error:', error);
        throw error;
      }
    },

    /**
     * 顯示成功訊息
     */
    showSuccessMessage(message) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: '匯出成功',
          text: message,
          timer: 3000,
          showConfirmButton: false
        });
      } else {
        alert(message);
      }
    },

    /**
     * 顯示錯誤訊息
     */
    showErrorMessage(message, error) {
      console.error(message, error);
      const errorText = error?.message || error || '未知錯誤';
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: '匯出失敗',
          text: `${message}: ${errorText}`,
          confirmButtonText: '確定'
        });
      } else {
        alert(`${message}: ${errorText}`);
      }
    },
  }
}).mount('#app_main');