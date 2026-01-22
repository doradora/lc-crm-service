const categoryList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      category: [],
      isLoading: false,
      searchQuery: "",
      selectedCategories: [],
      selectAll: false,
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      totalCount: 0, // 總筆數
      pageSize: 10, // 每頁顯示的項目數,可調整
      menuPosition: {
        x: 0,
        y: 0,
      },
      showModal: false,
      isEditMode: false,
      editCategoryId: null,
      newCategory: {
        code: "",
        description: "",
        enforce_three_digit_number: true,
      },
      sortKey: "",
      sortDirection: "asc",

      // 自定義欄位相關
      currentCategory: null,
      customFields: {},
      originalCustomFields: {},
      showFieldForm: false,
      isFieldEditMode: false,
      fieldForm: {
        name: "",
        display_name: "",
        type: "text",
        required: false,
        order: 0,
      },
    };
  },
  computed: {
    // 計算需要顯示的頁碼
    displayedPages() {
      const total = this.totalPages;
      const current = this.currentPage;
      const delta = 2; // 當前頁的左右顯示頁數
      let pages = [];

      // 計算應該顯示哪些頁碼
      for (let i = 1; i <= total; i++) {
        if (
          i === 1 ||
          i === total ||
          (i >= current - delta && i <= current + delta)
        ) {
          pages.push(i);
        }
      }

      // 添加省略號
      let result = [];
      let prev = 0;
      for (let page of pages) {
        if (prev && page > prev + 1) {
          result.push("...");
        }
        result.push(page);
        prev = page;
      }
      return result;
    },
  },
  methods: {
    // 處理 API 請求的共用函數
    async handleApiRequest(url, method, body = null) {
      try {
        const headers = {
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        };

        if (body) {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {
          method: method,
          headers: headers,
          credentials: "same-origin", // 確保發送認證信息
          body: body ? JSON.stringify(body) : null,
        });

        if (response.status === 401 || response.status === 403) {
          // 處理認證錯誤
          window.location.href =
            "/login/?next=" + encodeURIComponent(window.location.pathname);
          throw new Error("需要登入");
        }

        if (!response.ok) {
          throw new Error(`API 請求失敗，狀態碼: ${response.status}`);
        }

        if (method === "DELETE") {
          return true; // DELETE 請求通常不返回內容
        }

        return await response.json();
      } catch (error) {
        console.error("API 請求錯誤:", error);
        throw error;
      }
    },

    deleteCategory(categoryId) {
      if (confirm("確定要刪除此類別嗎？")) {
        this.handleApiRequest(`/crm/api/categories/${categoryId}/`, "DELETE")
          .then(() => {
            this.fetchCategories(this.currentPage);
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
    },
    editCategory(category) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editCategoryId = category.id;

      // 填充表單數據
      this.newCategory = {
        code: category.code,
        description: category.description,
        enforce_three_digit_number: category.enforce_three_digit_number !== undefined ? category.enforce_three_digit_number : true,
      };

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addCategoryModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    createCategory() {
      this.showModal = true;
      this.isEditMode = false;
      this.editCategoryId = null;
      this.newCategory = {
        code: "",
        description: "",
        enforce_three_digit_number: true,
      };
      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addCategoryModal")
      );
      modal.show();
    },
    fetchCategories(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/categories/?format=json&page=${page}&page_size=${this.pageSize}`;

      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      this.handleApiRequest(url, "GET")
        .then((data) => {
          this.category = data.results;
          this.totalCount = data.count || 0;
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching categories:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },
    toggleMenu(categoryId) {
      if (this.activeMenu === categoryId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120,
          y: rect.bottom + 10,
        };
        this.activeMenu = categoryId;
      }
      event.stopPropagation();
    },
    getMenuStyle(categoryId) {
      if (this.activeMenu !== categoryId) {
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
    hideAddCategoryModal() {
      this.showModal = false;
      // 重置表單數據
      this.newCategory = {
        code: "",
        description: "",
        enforce_three_digit_number: true,
      };
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addCategoryModal")
      );
      modal.hide();
    },
    submitCategoryForm() {
      const formData = {
        code: this.newCategory.code,
        description: this.newCategory.description,
        enforce_three_digit_number: this.newCategory.enforce_three_digit_number,
      };

      const url = this.isEditMode
        ? `/crm/api/categories/${this.editCategoryId}/`
        : "/crm/api/categories/";
      const method = this.isEditMode ? "PUT" : "POST";

      this.handleApiRequest(url, method, formData)
        .then(() => {
          this.hideAddCategoryModal();
          this.fetchCategories(this.currentPage);
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(
            this.isEditMode
              ? "更新類別失敗，請稍後再試"
              : "創建類別失敗，請稍後再試"
          );
        });
    },

    // 自定義欄位相關功能
    getCustomFieldsCount(category) {
      if (!category.custom_field_schema) return 0;
      return Object.keys(category.custom_field_schema).length;
    },

    manageCustomFields(category) {
      this.currentCategory = category;
      this.customFields = { ...(category.custom_field_schema || {}) };
      this.originalCustomFields = { ...(category.custom_field_schema || {}) };
      this.showFieldForm = false;
      this.isFieldEditMode = false;

      // 顯示自定義欄位管理模態框
      const modal = new bootstrap.Modal(
        document.getElementById("customFieldsModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },

    hideCustomFieldsModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("customFieldsModal")
      );
      if (modal) {
        modal.hide();
      }
      this.currentCategory = null;
      this.customFields = {};
      this.originalCustomFields = {};
      this.showFieldForm = false;
    },

    addNewCustomField() {
      this.isFieldEditMode = false;
      this.fieldForm = {
        name: "",
        display_name: "",
        type: "text",
        required: false,
        order: this.getMaxOrder() + 10, // 預設排序為目前最大值+10
      };
      this.showFieldForm = true;
    },

    getMaxOrder() {
      let maxOrder = 0;
      for (const fieldName in this.customFields) {
        const field = this.customFields[fieldName];
        if (field.order > maxOrder) {
          maxOrder = field.order;
        }
      }
      return maxOrder;
    },

    editCustomField(fieldName, field) {
      this.isFieldEditMode = true;
      this.fieldForm = {
        name: fieldName,
        display_name: field.display_name,
        type: field.type,
        required: field.required || false,
        order: field.order || 0,
      };
      this.showFieldForm = true;
    },

    cancelFieldEdit() {
      this.showFieldForm = false;
      this.fieldForm = {
        name: "",
        display_name: "",
        type: "text",
        required: false,
        order: 0,
      };
    },

    saveCustomField() {
      const { name, display_name, type, required, order } = this.fieldForm;

      // 驗證欄位名稱
      if (!name.trim()) {
        alert("欄位名稱不能為空");
        return;
      }

      // 檢查欄位名稱是否重複 (僅在新增模式下檢查)
      if (!this.isFieldEditMode && this.customFields[name]) {
        alert("已存在相同名稱的欄位");
        return;
      }

      // 儲存欄位
      this.customFields[name] = {
        display_name,
        type,
        required,
        order: parseInt(order) || 0,
      };

      // 重置表單並隱藏
      this.showFieldForm = false;
      this.fieldForm = {
        name: "",
        display_name: "",
        type: "text",
        required: false,
        order: 0,
      };
    },

    deleteCustomField(fieldName) {
      if (confirm(`確定要刪除欄位 "${fieldName}" 嗎？`)) {
        const newCustomFields = { ...this.customFields };
        delete newCustomFields[fieldName];
        this.customFields = newCustomFields;
      }
    },

    saveCustomFieldsChanges() {
      // 更新自定義欄位
      this.isLoading = true;
      this.handleApiRequest(
        `/crm/api/categories/${this.currentCategory.id}/update_custom_fields/`,
        "POST",
        this.customFields
      )
        .then((response) => {
          // 更新本地類別資料
          const updatedCategory = {
            ...this.currentCategory,
            custom_field_schema: response,
          };

          // 更新類別列表中的類別
          const categoryIndex = this.category.findIndex(
            (c) => c.id === updatedCategory.id
          );
          if (categoryIndex >= 0) {
            this.category.splice(categoryIndex, 1, updatedCategory);
          }

          this.hideCustomFieldsModal();
          alert("自定義欄位已更新成功");
        })
        .catch((error) => {
          console.error("更新自定義欄位失敗:", error);
          alert("更新自定義欄位失敗，請稍後再試");
        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    getFieldTypeDisplay(type) {
      const typeMap = {
        text: "單行文字",
        textarea: "多行文字",
        number: "數字",
        date: "日期",
        boolean: "是/否",
      };
      return typeMap[type] || type;
    },
  },
  mounted() {
    this.fetchCategories();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
