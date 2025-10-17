const invoicesList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      invoices: [],
      quotations: [], // 專案的報價單列表
      projectId: PROJECT_ID, // 從模板傳入的專案ID
      projectName: PROJECT_NAME, // 從模板傳入的專案名稱
      isLoading: false,
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      pageSize: 10, // 每頁顯示的項目數，可調整
      menuPosition: {
        x: 0,
        y: 0,
      },
      showModal: false,
      isEditMode: false,
      editInvoiceId: null,
      newInvoice: {
        quotation: "", // 選擇的報價單ID
        amount: 0,
        date_issued: new Date().toISOString().split("T")[0], // 預設為今天
        paid: false,
      },
    };
  },
  methods: {
    deleteInvoice(invoiceId) {
      if (confirm("確定要刪除此請款單嗎？此操作無法還原！")) {
        fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              '[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("刪除失敗");
            }
            this.fetchInvoices(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
    },
    editInvoice(invoice) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editInvoiceId = invoice.id;

      // 深度複製請款數據，避免直接修改列表數據
      this.newInvoice = {
        quotation: invoice.quotation,
        amount: invoice.amount,
        date_issued: invoice.date_issued,
        paid: invoice.paid,
      };

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    markAsPaid(invoiceId) {
      this.updateInvoiceStatus(invoiceId, true);
    },
    markAsUnpaid(invoiceId) {
      this.updateInvoiceStatus(invoiceId, false);
    },
    updateInvoiceStatus(invoiceId, isPaid) {
      fetch(`/crm/api/invoices/${invoiceId}/`, {
        method: "PATCH", // 局部更新
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]')
            .value,
        },
        body: JSON.stringify({ paid: isPaid }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("狀態更新失敗");
          }
          this.fetchInvoices(this.currentPage); // 重新獲取資料
          this.activeMenu = null; // 關閉選單
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("更新狀態失敗，請稍後再試");
        });
    },
    fetchInvoices(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/invoices/?format=json&page=${page}&page_size=${this.pageSize}&project=${this.projectId}`;

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.invoices = data.results;
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching invoices:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },
    fetchQuotations() {
      // 獲取此專案的所有報價單
      fetch(
        `/crm/api/quotations/?format=json&page_size=100&project=${this.projectId}`
      )
        .then((response) => response.json())
        .then((data) => {
          this.quotations = data.results;
        })
        .catch((error) => console.error("Error fetching quotations:", error));
    },
    formatDate(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    },
    formatCurrency(value) {
      return Number(value).toLocaleString("zh-TW", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    getStatusBadgeClass(invoice) {
      // 根據是否已付款顯示不同顏色
      return invoice.paid
        ? "badge badge-success"
        : "badge badge-warning";
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
    showAddInvoiceModal() {
      this.showModal = true;
      this.isEditMode = false;
      this.editInvoiceId = null;

      // 重置表單數據
      this.newInvoice = {
        quotation: "",
        amount: 0,
        date_issued: new Date().toISOString().split("T")[0], // 預設為今天
        paid: false,
      };

      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
    },
    getMenuStyle(invoiceId) {
      if (this.activeMenu !== invoiceId) {
        return { display: "none" };
      }
      return {
        "z-index": "107",
        position: "fixed",
        inset: "0px auto auto 0px",
        margin: "0px",
        transform: `translate(${this.menuPosition.x}px, ${this.menuPosition.y}px)`,
      };
    },
    handleClickOutside(event) {
      // 如果點擊的不是下拉選單或操作按鈕，則關閉選單
      if (this.activeMenu !== null) {
        const menu = document.querySelector(".menu.show");
        const button = document.querySelector(".btn-active-light-primary");

        if (
          menu &&
          !menu.contains(event.target) &&
          button &&
          !button.contains(event.target)
        ) {
          this.activeMenu = null;
        }
      }
    },
    hideAddInvoiceModal() {
      this.showModal = false;

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addInvoiceModal")
      );
      modal.hide();
    },
    submitInvoiceForm() {
      const url = this.isEditMode
        ? `/crm/api/invoices/${this.editInvoiceId}/`
        : "/crm/api/invoices/";
      const method = this.isEditMode ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(this.newInvoice),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(this.isEditMode ? "更新請款失敗" : "創建請款失敗");
          }
          return response.json();
        })
        .then(() => {
          this.hideAddInvoiceModal(); // 提交成功後關閉 Modal
          this.fetchInvoices(this.currentPage); // 刷新請款列表
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(
            this.isEditMode
              ? "更新請款失敗，請稍後再試"
              : "創建請款失敗，請稍後再試"
          );
        });
    },
  },
  mounted() {
    this.fetchInvoices();
    this.fetchQuotations();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
