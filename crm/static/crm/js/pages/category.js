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
      pageSize: 10, // 每頁顯示的項目數，可調整
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
      },
      sortKey: "",
      sortDirection: "asc",
    };
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
