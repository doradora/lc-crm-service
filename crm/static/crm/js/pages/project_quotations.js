const quotationsList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      quotations: [],
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
      editQuotationId: null,
      newQuotation: {
        project: PROJECT_ID, // 預設為目前專案
        amount: 0,
        date_issued: new Date().toISOString().split("T")[0], // 預設為今天
      },
    };
  },
  methods: {
    deleteQuotation(quotationId) {
      if (confirm("確定要刪除此報價嗎？此操作無法還原！")) {
        fetch(`/crm/api/quotations/${quotationId}/`, {
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
            this.fetchQuotations(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
    },
    editQuotation(quotation) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editQuotationId = quotation.id;

      // 深度複製報價數據，避免直接修改列表數據
      this.newQuotation = {
        project: quotation.project,
        amount: quotation.amount,
        date_issued: quotation.date_issued,
      };

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addQuotationModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    addInvoice(quotation) {
      // 導航到建立請款單頁面
      window.location.href = `/crm/project/${this.projectId}/quotations/${quotation.id}/invoice/`;
      // 關閉下拉選單
      this.activeMenu = null;
    },
    fetchQuotations(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/quotations/?format=json&page=${page}&page_size=${this.pageSize}&project=${this.projectId}`;

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.quotations = data.results;
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching quotations:", error))
        .finally(() => {
          this.isLoading = false;
        });
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
    getStatusText(quotation) {
      // 根據是否有請款單判斷狀態
      return quotation.has_invoice ? "已建立請款單" : "未建立請款單";
    },
    getStatusBadgeClass(quotation) {
      // 根據是否有請款單顯示不同顏色
      return quotation.has_invoice
        ? "badge badge-success"
        : "badge badge-warning";
    },
    toggleMenu(quotationId) {
      if (this.activeMenu === quotationId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120, // 向左偏移 120px
          y: rect.bottom + 10, // 向下偏移 10px
        };
        this.activeMenu = quotationId;
      }
      event.stopPropagation();
    },
    showAddQuotationModal() {
      this.showModal = true;
      this.isEditMode = false;
      this.editQuotationId = null;

      // 重置表單數據
      this.newQuotation = {
        project: this.projectId,
        amount: 0,
        date_issued: new Date().toISOString().split("T")[0], // 預設為今天
      };

      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addQuotationModal")
      );
      modal.show();
    },
    getMenuStyle(quotationId) {
      if (this.activeMenu !== quotationId) {
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
    hideAddQuotationModal() {
      this.showModal = false;

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addQuotationModal")
      );
      modal.hide();
    },
    submitQuotationForm() {
      const url = this.isEditMode
        ? `/crm/api/quotations/${this.editQuotationId}/`
        : "/crm/api/quotations/";
      const method = this.isEditMode ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(this.newQuotation),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(this.isEditMode ? "更新報價失敗" : "創建報價失敗");
          }
          return response.json();
        })
        .then(() => {
          this.hideAddQuotationModal(); // 提交成功後關閉 Modal
          this.fetchQuotations(this.currentPage); // 刷新報價列表
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(
            this.isEditMode
              ? "更新報價失敗，請稍後再試"
              : "創建報價失敗，請稍後再試"
          );
        });
    },
  },
  mounted() {
    this.fetchQuotations();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
