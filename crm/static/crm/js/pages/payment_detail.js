const paymentDetail = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      // 請款單資料
      payment: {
        id: null,
        payment_number: "",
        amount: 0,
        date_issued: "",
        due_date: null,
        paid: false,
        payment_date: null,
        notes: "",
        created_by: null,
        created_by_name: "",
        created_at: "",
        payment_projects: [], // 請款單對應的專案
        invoices: [], // 請款單對應的發票
      },

      // 請款單ID
      paymentId: null,

      // 發票相關
      editingInvoice: false,
      newInvoice: {
        invoice_number: "",
        amount: 0,
        issue_date: new Date().toISOString().split("T")[0], // 今天的日期
        tax_amount: 0,
        notes: "",
      },

      // 專案相關
      projects: [], // 所有可選擇的專案
      filteredProjects: [], // 搜尋結果
      projectSearchTerm: "", // 專案搜尋詞
      showProjectDropdown: false,
      selectedProject: null,
      newProjectItem: {
        project: null,
        amount: 0,
        description: "",
      },
    };
  },
  directives: {
    // 點擊元素外部時觸發的自定義指令
    clickOutside: {
      mounted(el, binding) {
        el._clickOutside = (event) => {
          if (!(el === event.target || el.contains(event.target))) {
            binding.value(event);
          }
        };
        document.addEventListener("click", el._clickOutside);
      },
      unmounted(el) {
        document.removeEventListener("click", el._clickOutside);
      },
    },
  },
  methods: {
    // 從 URL 獲取請款單 ID
    getPaymentIdFromUrl() {
      const pathParts = window.location.pathname.split("/");
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "payment" && i + 1 < pathParts.length) {
          return parseInt(pathParts[i + 1]);
        }
      }
      return null;
    },

    // 獲取請款單詳情
    fetchPaymentDetails() {
      fetch(`/crm/api/payments/${this.paymentId}/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取請款單資料");
          }
          return response.json();
        })
        .then((data) => {
          this.payment = data;

          // 如果請款單日期是 null，設為空字符串以避免 Vue 警告
          if (this.payment.date_issued === null) {
            this.payment.date_issued = "";
          }
          if (this.payment.due_date === null) {
            this.payment.due_date = "";
          }
          if (this.payment.payment_date === null) {
            this.payment.payment_date = "";
          }
        })
        .catch((error) => {
          console.error("Error fetching payment details:", error);
          alert("獲取請款單資料失敗");
        });
    },

    // 獲取所有專案列表（用於新增專案）
    fetchProjects() {
      fetch(`/crm/api/projects/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
          // 初始狀態下不顯示任何專案
          this.filteredProjects = [];
        })
        .catch((error) => console.error("Error fetching projects:", error));
    },

    // 儲存請款單
    savePayment() {
      // 準備要提交的數據
      const formData = {
        payment_number: this.payment.payment_number,
        date_issued: this.payment.date_issued || null,
        due_date: this.payment.due_date || null,
        paid: this.payment.paid,
        payment_date: this.payment.paid
          ? this.payment.payment_date || null
          : null,
        notes: this.payment.notes,
      };

      fetch(`/crm/api/payments/${this.paymentId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(formData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(JSON.stringify(err));
            });
          }
          return response.json();
        })
        .then((data) => {
          this.payment = data;
          alert("請款單資料已更新");
        })
        .catch((error) => {
          console.error("Error saving payment:", error);
          alert(`儲存失敗: ${error.message}`);
        });
    },

    // 刪除請款單
    deletePayment() {
      if (confirm("確定要刪除此請款單嗎？此操作無法還原！")) {
        fetch(`/crm/api/payments/${this.paymentId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              'input[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("刪除失敗");
            }
            // 刪除成功後跳轉回請款列表頁面
            window.location.href = "/crm/payments/";
          })
          .catch((error) => {
            console.error("Error deleting payment:", error);
            alert(`刪除失敗: ${error.message}`);
          });
      }
    },

    // 更新總金額
    updateTotalAmount(projectItem) {
      // 確保傳入的是 PaymentProject 物件
      if (!projectItem || !projectItem.id) return;

      // 更新單個 PaymentProject 金額
      fetch(`/crm/api/payment-projects/${projectItem.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify({
          amount: projectItem.amount,
          description: projectItem.description,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("更新金額失敗");
          }
          return response.json();
        })
        .then((data) => {
          // 成功更新後重新獲取請款單資料，這樣會連帶更新總金額
          this.fetchPaymentDetails();
        })
        .catch((error) => {
          console.error("Error updating project amount:", error);
          alert(`更新金額失敗: ${error.message}`);
        });
    },

    // 搜尋專案
    searchProjects() {
      if (!this.projectSearchTerm.trim()) {
        this.filteredProjects = this.projects.slice(0, 10); // 顯示前10個
        return;
      }

      const searchTerm = this.projectSearchTerm.toLowerCase();
      this.filteredProjects = this.projects
        .filter(
          (project) =>
            project.name.toLowerCase().includes(searchTerm) ||
            (project.owner_name &&
              project.owner_name.toLowerCase().includes(searchTerm))
        )
        .slice(0, 10); // 最多顯示10個結果
    },

    // 選擇專案
    selectProject(project) {
      this.selectedProject = project;
      this.projectSearchTerm = project.name;
      this.newProjectItem.project = project.id;
      this.showProjectDropdown = false;
    },

    // 關閉專案下拉選單
    closeProjectDropdown() {
      this.showProjectDropdown = false;
    },

    // 顯示新增專案 Modal
    showAddProjectModal() {
      // 重置新專案表單
      this.selectedProject = null;
      this.projectSearchTerm = "";
      this.newProjectItem = {
        project: null,
        amount: 0,
        description: "",
      };

      // 顯示 Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
    },

    // 隱藏新增專案 Modal
    hideAddProjectModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 提交專案表單
    submitProjectForm() {
      if (!this.newProjectItem.project) {
        alert("請選擇專案");
        return;
      }

      if (!this.newProjectItem.amount || this.newProjectItem.amount <= 0) {
        alert("請輸入有效的請款金額");
        return;
      }

      const projectData = {
        payment: this.paymentId,
        project: this.newProjectItem.project,
        amount: this.newProjectItem.amount,
        description: this.newProjectItem.description,
      };

      fetch("/crm/api/payment-projects/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(projectData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(JSON.stringify(err));
            });
          }
          return response.json();
        })
        .then((data) => {
          // 成功新增專案後，重新獲取請款單資料
          this.fetchPaymentDetails();
          this.hideAddProjectModal();
          alert("專案已成功新增到請款單");
        })
        .catch((error) => {
          console.error("Error adding project:", error);
          alert(`新增專案失敗: ${error.message}`);
        });
    },

    // 移除專案
    removeProject(projectItemId) {
      if (confirm("確定要從請款單中移除此專案嗎？")) {
        fetch(`/crm/api/payment-projects/${projectItemId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              'input[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("移除專案失敗");
            }
            // 成功移除專案後，重新獲取請款單資料
            this.fetchPaymentDetails();
            alert("專案已成功從請款單中移除");
          })
          .catch((error) => {
            console.error("Error removing project:", error);
            alert(`移除專案失敗: ${error.message}`);
          });
      }
    },

    // 顯示新增/編輯發票 Modal
    showAddInvoiceModal(invoice = null) {
      this.editingInvoice = !!invoice;

      if (invoice) {
        // 如果是編輯模式，複製現有發票數據
        this.newInvoice = {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          issue_date: invoice.issue_date,
          tax_amount: invoice.tax_amount || 0,
          notes: invoice.notes || "",
        };
      } else {
        // 如果是新增模式，重置表單
        this.newInvoice = {
          invoice_number: "",
          amount: this.payment.amount, // 預設使用請款單金額
          issue_date: new Date().toISOString().split("T")[0], // 今天的日期
          tax_amount: 0,
          notes: "",
        };
      }

      // 顯示 Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
    },

    // 隱藏新增/編輯發票 Modal
    hideAddInvoiceModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addInvoiceModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 編輯發票
    editInvoice(invoice) {
      this.showAddInvoiceModal(invoice);
    },

    // 刪除發票
    deleteInvoice(invoiceId) {
      if (confirm("確定要刪除此發票嗎？此操作無法還原！")) {
        fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              'input[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("刪除發票失敗");
            }
            // 刪除成功後，重新獲取請款單數據以更新發票列表
            this.fetchPaymentDetails();
            alert("發票已成功刪除");
          })
          .catch((error) => {
            console.error("Error deleting invoice:", error);
            alert(`刪除發票失敗: ${error.message}`);
          });
      }
    },

    // 提交發票表單
    submitInvoiceForm() {
      if (
        !this.newInvoice.invoice_number ||
        !this.newInvoice.amount ||
        !this.newInvoice.issue_date
      ) {
        alert("請填寫所有必填欄位");
        return;
      }

      const invoiceData = {
        invoice_number: this.newInvoice.invoice_number,
        payment: this.paymentId,
        amount: this.newInvoice.amount,
        issue_date: this.newInvoice.issue_date,
        tax_amount: this.newInvoice.tax_amount || 0,
        notes: this.newInvoice.notes || "",
      };

      const url = this.editingInvoice
        ? `/crm/api/invoices/${this.newInvoice.id}/`
        : "/crm/api/invoices/";
      const method = this.editingInvoice ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(invoiceData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(JSON.stringify(err));
            });
          }
          return response.json();
        })
        .then((data) => {
          // 成功處理發票後，重新獲取請款單數據
          this.fetchPaymentDetails();
          this.hideAddInvoiceModal();
          alert(this.editingInvoice ? "發票已成功更新" : "發票已成功新增");
        })
        .catch((error) => {
          console.error("Error saving invoice:", error);
          alert(`處理發票失敗: ${error.message}`);
        });
    },

    // 格式化金額
    formatAmount(amount) {
      return parseFloat(amount).toLocaleString("zh-TW", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },

    // 匯出Excel功能
    exportToExcel() {
      // 顯示載入中提示
      this.$swal.fire({
        title: "處理中...",
        text: "正在生成Excel文件，請稍候",
        allowOutsideClick: false,
        didOpen: () => {
          this.$swal.showLoading();
        },
      });

      // 調用後端API
      window.location.href = `/crm/payment/${this.paymentId}/export_excel/`;
    },
  },
  mounted() {
    this.paymentId = this.getPaymentIdFromUrl();

    if (!this.paymentId) {
      alert("無效的請款單 ID");
      window.location.href = "/crm/payments/";
      return;
    }

    // 獲取請款單詳情
    this.fetchPaymentDetails();
    this.fetchProjects();
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
