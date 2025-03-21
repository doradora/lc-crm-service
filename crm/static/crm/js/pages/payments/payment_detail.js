const paymentDetail = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      payment: {
        payment_number: "",
        amount: 0,
        date_issued: "",
        due_date: "",
        paid: false,
        payment_date: null,
        notes: "",
        payment_projects: [],
        invoices: [],
        created_by_name: "",
      },
      paymentId: null,
      projects: [],
      isLoading: true,
      isEditing: false,
      originalPayment: null,
      // 新增發票相關資料
      newInvoice: {
        invoice_number: "",
        amount: 0,
        tax_amount: 0,
        issue_date: "",
        notes: "",
      },
      editingInvoice: false,
      editingInvoiceId: null,
      // 新增專案搜索相關資料
      newProjectItem: {
        project: null,
        amount: 0,
        description: "",
      },
      projectSearchTerm: "",
      showProjectDropdown: false,
      filteredProjects: [],
      // 目前活躍的Tab
      activeTab: "projects_tab", // 預設顯示專案明細分頁
    };
  },
  methods: {
    // 獲取付款詳情
    fetchPaymentDetails() {
      this.isLoading = true;
      fetch(`/crm/api/payments/${this.paymentId}/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取請款單詳情");
          }
          return response.json();
        })
        .then((data) => {
          this.payment = data;
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("獲取請款單資料失敗：" + error.message);
        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    // 獲取所有專案，用於編輯時選擇
    fetchProjects() {
      fetch("/crm/api/projects/?format=json&page_size=1000")
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
        })
        .catch((error) => console.error("Error fetching projects:", error));
    },

    // 格式化日期顯示
    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    },

    // 格式化金額顯示
    formatCurrency(value) {
      if (value === null || value === undefined) return "-";
      return new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        minimumFractionDigits: 0,
      }).format(value);
    },

    // 獲取狀態標籤樣式
    getStatusBadgeClass() {
      return this.payment.paid ? "badge-light-success" : "badge-light-warning";
    },

    // 計算所有專案項目的總金額
    getTotalAmount() {
      if (
        !this.payment.payment_projects ||
        this.payment.payment_projects.length === 0
      ) {
        return 0;
      }
      return this.payment.payment_projects.reduce((total, item) => {
        return total + Number(item.amount || 0);
      }, 0);
    },

    // 切換編輯模式
    toggleEditMode() {
      if (this.isEditing) {
        this.saveChanges();
        return;
      }
      this.isEditing = true;
      // 深度複製當前資料，以便稍後取消時還原
      this.originalPayment = JSON.parse(JSON.stringify(this.payment));
    },

    // 取消編輯
    cancelEdit() {
      this.isEditing = false;
      // 還原資料
      if (this.originalPayment) {
        this.payment = JSON.parse(JSON.stringify(this.originalPayment));
      }
    },

    // 保存修改
    saveChanges() {
      // 計算總金額
      const totalAmount = this.getTotalAmount();

      // 驗證必填欄位
      if (!this.payment.payment_number) {
        alert("請輸入請款單號");
        return;
      }

      if (!this.payment.date_issued) {
        alert("請選擇請款日期");
        return;
      }

      // 驗證專案明細
      if (this.payment.payment_projects.length === 0) {
        alert("請至少添加一個專案明細");
        return;
      }

      for (let item of this.payment.payment_projects) {
        if (!item.project) {
          alert("請為每一個明細選擇專案");
          return;
        }

        if (!item.amount || item.amount <= 0) {
          alert("請為每一個明細輸入有效的金額");
          return;
        }
      }

      // 準備更新資料
      const updateData = {
        payment_number: this.payment.payment_number,
        date_issued: this.payment.date_issued,
        due_date: this.payment.due_date,
        paid: this.payment.paid,
        payment_date: this.payment.paid ? this.payment.payment_date : null,
        notes: this.payment.notes,
      };

      // 更新請款單基本資料
      fetch(`/crm/api/payments/${this.paymentId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]')
            .value,
        },
        body: JSON.stringify(updateData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("更新請款單失敗");
          }
          return response.json();
        })
        .then(() => {
          // 處理專案明細
          const projectPromises = [];

          // 更新或新增專案明細
          this.payment.payment_projects.forEach((item) => {
            const projectItemData = {
              payment: this.paymentId,
              project: item.project,
              amount: item.amount,
              description: item.description || "",
            };

            if (item.id) {
              // 更新現有的專案明細
              projectPromises.push(
                fetch(`/crm/api/payment-projects/${item.id}/`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector(
                      '[name="csrfmiddlewaretoken"]'
                    ).value,
                  },
                  body: JSON.stringify(projectItemData),
                })
              );
            } else {
              // 新增專案明細
              projectPromises.push(
                fetch("/crm/api/payment-projects/", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector(
                      '[name="csrfmiddlewaretoken"]'
                    ).value,
                  },
                  body: JSON.stringify(projectItemData),
                })
              );
            }
          });

          return Promise.all(projectPromises);
        })
        .then(() => {
          this.isEditing = false;
          alert("請款單更新成功");
          this.fetchPaymentDetails(); // 重新獲取資料
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("更新請款單失敗：" + error.message);
        });
    },

    // 添加專案項目
    addProjectItem() {
      this.newProjectItem = {
        project: null,
        amount: 0,
        description: "",
      };
      this.projectSearchTerm = "";
      this.filteredProjects = [...this.projects];
      this.showProjectDropdown = false; // 確保下拉框初始關閉

      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
    },

    hideAddProjectModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    searchProjects() {
      if (!this.projectSearchTerm) {
        this.filteredProjects = [...this.projects];
        return;
      }

      const term = this.projectSearchTerm.toLowerCase();
      this.filteredProjects = this.projects.filter(
        (project) =>
          project.name.toLowerCase().includes(term) ||
          (project.owner_name &&
            project.owner_name.toLowerCase().includes(term))
      );
    },

    selectProject(project) {
      this.newProjectItem.project = project.id;
      this.projectSearchTerm = project.name;
      this.showProjectDropdown = false;
    },

    submitProjectForm() {
      if (!this.newProjectItem.project) {
        alert("請選擇專案");
        return;
      }

      if (!this.newProjectItem.amount || this.newProjectItem.amount <= 0) {
        alert("請輸入有效的金額");
        return;
      }

      // 找到選擇的專案完整資訊
      const selectedProject = this.projects.find(
        (p) => p.id === this.newProjectItem.project
      );

      this.payment.payment_projects.push({
        project: this.newProjectItem.project,
        project_name: selectedProject ? selectedProject.name : "",
        amount: this.newProjectItem.amount,
        description: this.newProjectItem.description || "",
      });

      this.hideAddProjectModal();
    },

    closeProjectDropdown() {
      this.showProjectDropdown = false;
    },

    // 移除專案項目
    removeProjectItem(index) {
      const item = this.payment.payment_projects[index];

      if (item.id) {
        // 如果是資料庫中的項目，需要發送刪除請求
        if (confirm("確定要刪除此專案明細嗎？")) {
          fetch(`/crm/api/payment-projects/${item.id}/`, {
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
              this.payment.payment_projects.splice(index, 1);
            })
            .catch((error) => {
              console.error("Error:", error);
              alert("刪除專案明細失敗：" + error.message);
            });
        }
      } else {
        // 如果是新增的項目，直接從陣列中移除
        this.payment.payment_projects.splice(index, 1);
      }
    },

    // 創建發票
    createInvoice() {
      this.editingInvoice = false;
      this.editingInvoiceId = null;
      this.newInvoice = {
        invoice_number: "",
        amount: 0,
        tax_amount: 0,
        issue_date: new Date().toISOString().split("T")[0],
        notes: "",
      };

      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
    },

    // 顯示編輯發票 Modal
    editInvoice(invoiceId) {
      this.editingInvoice = true;
      this.editingInvoiceId = invoiceId;

      // 找到對應的發票
      const invoice = this.payment.invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        this.newInvoice = { ...invoice };
      }

      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
    },

    // 隱藏發票 Modal
    hideAddInvoiceModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addInvoiceModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 提交發票表單
    submitInvoiceForm() {
      // 驗證必填欄位
      if (!this.newInvoice.invoice_number) {
        alert("請輸入發票號碼");
        return;
      }

      if (!this.newInvoice.amount || this.newInvoice.amount <= 0) {
        alert("請輸入有效的發票金額");
        return;
      }

      if (!this.newInvoice.issue_date) {
        alert("請選擇開立日期");
        return;
      }

      const invoiceData = {
        invoice_number: this.newInvoice.invoice_number,
        amount: this.newInvoice.amount,
        tax_amount: this.newInvoice.tax_amount || 0,
        issue_date: this.newInvoice.issue_date,
        notes: this.newInvoice.notes || "",
        payment: this.paymentId,
      };

      let url = "/crm/api/invoices/";
      let method = "POST";

      // 如果是編輯發票
      if (this.editingInvoice && this.editingInvoiceId) {
        url = `/crm/api/invoices/${this.editingInvoiceId}/`;
        method = "PATCH";
      }

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]')
            .value,
        },
        body: JSON.stringify(invoiceData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("發票操作失敗");
          }
          return response.json();
        })
        .then(() => {
          this.hideAddInvoiceModal();
          this.fetchPaymentDetails(); // 重新獲取資料
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("發票操作失敗：" + error.message);
        });
    },

    // 刪除發票
    deleteInvoice(invoiceId) {
      if (confirm("確定要刪除此發票嗎？")) {
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
            this.fetchPaymentDetails(); // 重新獲取資料
          })
          .catch((error) => {
            console.error("Error:", error);
            alert("刪除發票失敗：" + error.message);
          });
      }
    },

    // Tab 切換處理
    handleTabChange(tabId) {
      this.activeTab = tabId;
    },
  },
  mounted() {
    // 從URL獲取payment ID
    const pathParts = window.location.pathname.split("/");
    this.paymentId = pathParts[pathParts.indexOf("payment") + 1];

    // 獲取資料
    this.fetchPaymentDetails();
    this.fetchProjects();

    // 初始化 Bootstrap tabs
    this.$nextTick(() => {
      // 確保元素已經渲染完成
      const tabElements = document.querySelectorAll('a[data-bs-toggle="tab"]');

      // 監聽Tab切換事件
      tabElements.forEach((tabEl) => {
        tabEl.addEventListener("shown.bs.tab", (event) => {
          // 提取不含#的tab ID
          const tabId = event.target.getAttribute("href").substring(1);
          this.activeTab = tabId;
          console.log("Tab changed to:", this.activeTab);
        });
      });
    });
  },
});

// 註冊自定義指令 v-click-outside
paymentDetail.directive("click-outside", {
  beforeMount(el, binding) {
    el.clickOutsideEvent = function (event) {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener("click", el.clickOutsideEvent);
  },
});

paymentDetail.mount("#app_main");
