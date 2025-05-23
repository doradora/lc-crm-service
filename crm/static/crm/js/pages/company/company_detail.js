const companyDetail = createApp({
  delimiters: ["[[", "]]"],  data() {
    return {
      company: {
        id: null,
        name: "",
        responsible_person: "",
        tax_id: "",
        address: "",
        phone: "",
        fax: "",
        contact_person: "",
      },
      editingCompany: { // 用於編輯模式的臨時數據
        id: null,
        name: "",
        responsible_person: "",
        tax_id: "",
        address: "",
        phone: "",
        fax: "",
        contact_person: "",
      },
      bankAccounts: [],
      payments: [],
      companyId: null,
      isAdmin: typeof is_superuser !== 'undefined' && is_superuser, // 檢查是否為管理員
      isEditMode: false,
      isLoading: true,
      isLoadingPayments: true,
      newBankAccount: {
        bank_name: "",
        bank_code: "",
        account_number: "",
        account_name: "",
      },
      isEditingBankAccount: false,
      editingBankAccountId: null,
    };
  },
  methods: {
    // 從 URL 獲取公司 ID
    getCompanyIdFromUrl() {
      const pathParts = window.location.pathname.split("/");
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "company" && i + 1 < pathParts.length) {
          return pathParts[i + 1];
        }
      }
      return null;
    },

    // 獲取公司詳情
    fetchCompanyDetails() {
      this.isLoading = true;
      fetch(`/crm/api/companys/${this.companyId}/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法取得公司資訊");
          }
          return response.json();
        })
        .then((data) => {
          this.company = data;
          this.isLoading = false;
          // 獲取銀行賬戶
          this.fetchBankAccounts();
          // 獲取請款記錄
          this.fetchPayments();
        })
        .catch((error) => {
          console.error("獲取公司詳情時發生錯誤:", error);
          this.isLoading = false;
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "無法取得公司資訊",
          });
        });
    },

    // 獲取公司的銀行賬戶
    fetchBankAccounts() {
      fetch(`/crm/api/companys/${this.companyId}/bank_accounts/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法取得銀行帳戶資訊");
          }
          return response.json();
        })
        .then((data) => {
          this.bankAccounts = data;
        })
        .catch((error) => {
          console.error("獲取銀行賬戶時發生錯誤:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "無法取得銀行帳戶資訊",
          });
        });
    },

    // 獲取與公司相關的請款記錄
    fetchPayments() {
      this.isLoadingPayments = true;
      fetch(`/crm/api/payments/?company=${this.companyId}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法取得請款記錄");
          }
          return response.json();
        })
        .then((data) => {
          this.payments = data.results;
          this.isLoadingPayments = false;
        })
        .catch((error) => {
          console.error("獲取請款記錄時發生錯誤:", error);
          this.isLoadingPayments = false;
        });
    },    // 顯示編輯公司資料的模態框
    showEditCompanyModal() {
      this.editingCompany = { ...this.company };
      const modal = new bootstrap.Modal(document.getElementById("editCompanyModal"));
      modal.show();
    },

    // 隱藏編輯公司資料模態框
    hideEditCompanyModal() {
      const modal = bootstrap.Modal.getInstance(document.getElementById("editCompanyModal"));
      if (modal) {
        modal.hide();
      }
    },

    // 提交編輯公司表單
    submitCompanyForm() {
      fetch(`/crm/api/companys/${this.companyId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]').value,
        },
        body: JSON.stringify(this.editingCompany),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法更新公司資訊");
          }
          return response.json();
        })
        .then((data) => {
          this.company = data;
          this.hideEditCompanyModal();
          Swal.fire({
            icon: "success",
            title: "成功",
            text: "公司資料已更新",
            timer: 1500,
          });
        })
        .catch((error) => {
          console.error("更新公司資訊時發生錯誤:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "無法更新公司資訊",
          });
        });
    },

    // 切換編輯模式 (保留，但不再使用)
    toggleEditMode() {
      this.isEditMode = !this.isEditMode;
    },

    // 取消編輯
    cancelEdit() {
      this.isEditMode = false;
      // 重新獲取公司資訊，放棄未保存的更改
      this.fetchCompanyDetails();
    },

    // 儲存公司資訊 (保留，但不再使用)
    saveCompany() {
      fetch(`/crm/api/companys/${this.companyId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]').value,
        },
        body: JSON.stringify(this.company),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法更新公司資訊");
          }
          return response.json();
        })
        .then((data) => {
          this.company = data;
          this.isEditMode = false;
          Swal.fire({
            icon: "success",
            title: "成功",
            text: "公司資料已更新",
            timer: 1500,
          });
        })
        .catch((error) => {
          console.error("更新公司資訊時發生錯誤:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "無法更新公司資訊",
          });
        });
    },

    // 顯示新增銀行帳戶的模態框
    showAddBankAccountModal() {
      this.isEditingBankAccount = false;
      this.editingBankAccountId = null;
      this.newBankAccount = {
        bank_name: "",
        bank_code: "",
        account_number: "",
        account_name: "",
      };

      const modal = new bootstrap.Modal(document.getElementById("bankAccountModal"));
      modal.show();
    },

    // 顯示編輯銀行帳戶的模態框
    editBankAccount(account) {
      this.isEditingBankAccount = true;
      this.editingBankAccountId = account.id;
      this.newBankAccount = { ...account };

      const modal = new bootstrap.Modal(document.getElementById("bankAccountModal"));
      modal.show();
    },

    // 隱藏銀行帳戶模態框
    hideBankAccountModal() {
      const modal = bootstrap.Modal.getInstance(document.getElementById("bankAccountModal"));
      if (modal) {
        modal.hide();
      }
    },

    // 提交銀行帳戶表單（新增或編輯）
    submitBankAccountForm() {
      let url = `/crm/api/bank-accounts/`;
      let method = "POST";

      if (this.isEditingBankAccount) {
        url = `/crm/api/bank-accounts/${this.editingBankAccountId}/`;
        method = "PUT";
      } else {
        this.newBankAccount.company = this.companyId;
      }

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]').value,
        },
        body: JSON.stringify(this.newBankAccount),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(this.isEditingBankAccount ? "無法更新銀行帳戶" : "無法新增銀行帳戶");
          }
          return response.json();
        })
        .then((data) => {
          this.hideBankAccountModal();
          // 重新獲取銀行帳戶列表
          this.fetchBankAccounts();
          Swal.fire({
            icon: "success",
            title: "成功",
            text: this.isEditingBankAccount ? "銀行帳戶已更新" : "銀行帳戶已新增",
            timer: 1500,
          });
        })
        .catch((error) => {
          console.error("提交銀行帳戶表單時發生錯誤:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: this.isEditingBankAccount ? "無法更新銀行帳戶" : "無法新增銀行帳戶",
          });
        });
    },

    // 刪除銀行帳戶
    deleteBankAccount(accountId) {
      Swal.fire({
        title: "確定要刪除此銀行帳戶嗎？",
        text: "此操作無法還原！",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "是，刪除！",
        cancelButtonText: "取消",
      }).then((result) => {
        if (result.isConfirmed) {
          fetch(`/crm/api/bank-accounts/${accountId}/`, {
            method: "DELETE",
            headers: {
              "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]').value,
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error("無法刪除銀行帳戶");
              }
              // 重新獲取銀行帳戶列表
              this.fetchBankAccounts();
              Swal.fire({
                icon: "success",
                title: "成功",
                text: "銀行帳戶已刪除",
                timer: 1500,
              });
            })
            .catch((error) => {
              console.error("刪除銀行帳戶時發生錯誤:", error);
              Swal.fire({
                icon: "error",
                title: "錯誤",
                text: "無法刪除銀行帳戶",
              });
            });
        }
      });
    },

    // 格式化金額顯示
    formatAmount(amount) {
      return parseFloat(amount).toLocaleString("zh-TW", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },

    // 獲取付款狀態樣式
    getPaymentStatusClass(payment) {
      return payment.paid ? "badge badge-light-success" : "badge badge-light-warning";
    },
  },
  mounted() {
    this.companyId = this.getCompanyIdFromUrl();

    if (!this.companyId) {
      Swal.fire({
        icon: "error",
        title: "錯誤",
        text: "無法識別公司ID",
      });
      window.location.href = "/crm/companys/";
      return;
    }

    // 獲取公司詳情
    this.fetchCompanyDetails();
  },
}).mount("#app_main");
