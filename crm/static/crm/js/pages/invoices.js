// 發票管理頁面 JavaScript
createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      invoices: [],
      payments: [],
      isLoading: true,
      isSaving: false,
      searchQuery: "",
      paymentStatusFilter: "",
      paymentMethodFilter: "",
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
      invoiceForm: {
        id: null,
        invoice_number: "",
        payment: "",
        amount: "",
        tax_amount: "",
        issue_date: "",
        payment_received_date: "",
        account_entry_date: "",
        payment_method: "",
        actual_received_amount: "",
        notes: ""
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
          if (this.paymentStatusFilter === 'paid') {
            params.append('payment_received_date__isnull', 'false');
          } else if (this.paymentStatusFilter === 'unpaid') {
            params.append('payment_received_date__isnull', 'true');
          }
        }

        if (this.paymentMethodFilter) {
          params.append('payment_method', this.paymentMethodFilter);
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
      const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
      modal.show();
    },

    editInvoice(invoice) {
      this.isEdit = true;
      this.validationErrors = {};
      this.invoiceForm = {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment: invoice.payment ? invoice.payment.id : "",
        amount: invoice.amount,
        tax_amount: invoice.tax_amount,
        issue_date: invoice.issue_date,
        payment_received_date: invoice.payment_received_date || "",
        account_entry_date: invoice.account_entry_date || "",
        payment_method: invoice.payment_method || "",
        actual_received_amount: invoice.actual_received_amount || "",
        notes: invoice.notes || ""
      };

      const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
      modal.show();
      this.activeMenu = null;
    },

    validateForm() {
      this.validationErrors = {};

      if (!this.invoiceForm.invoice_number) {
        this.validationErrors.invoice_number = true;
      }

      if (!this.invoiceForm.payment) {
        this.validationErrors.payment = true;
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

      return Object.keys(this.validationErrors).length === 0;
    },

    async saveInvoice() {
      if (!this.validateForm()) {
        this.showNotification('請填寫必填欄位', 'error');
        return;
      }

      this.isSaving = true;

      try {
        const formData = { ...this.invoiceForm };

        // 處理空值
        Object.keys(formData).forEach(key => {
          if (formData[key] === '') {
            formData[key] = null;
          }
        });

        const url = this.isEdit
          ? `/crm/api/invoices/${this.invoiceForm.id}/`
          : '/crm/api/invoices/';

        const method = this.isEdit ? 'PATCH' : 'POST';

        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '操作失敗');
        }

        this.showNotification(this.isEdit ? '發票更新成功！' : '發票新增成功！', 'success');
        this.closeInvoiceModal();
        this.fetchInvoices(this.currentPage);

      } catch (error) {
        console.error('Error saving invoice:', error);
        this.showNotification(error.message || '操作失敗', 'error');
      } finally {
        this.isSaving = false;
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
            payment_received_date: new Date().toISOString().split('T')[0]
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
            payment_received_date: null
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
      this.resetInvoiceForm();
    },

    resetInvoiceForm() {
      this.invoiceForm = {
        id: null,
        invoice_number: "",
        payment: "",
        amount: "",
        tax_amount: "",
        issue_date: "",
        payment_received_date: "",
        account_entry_date: "",
        payment_method: "",
        actual_received_amount: "",
        notes: ""
      };
      this.validationErrors = {};
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
      return invoice.payment_received_date
        ? 'badge badge-success'
        : 'badge badge-warning';
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
    }
  }
}).mount('#app_main');