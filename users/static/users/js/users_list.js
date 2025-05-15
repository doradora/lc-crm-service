const userList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      users: [],
      isLoading: false,
      searchQuery: "",
      roleFilter: "all",
      selectedUsers: [],
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
      editUserId: null,
      newUser: {
        username: "",
        email: "",
        firstName: "",
        lastName: "",
        password: "", // 新增密碼
        passwordConfirm: "", // 新增確認密碼
        profile: {
          // 改為物件管理多值角色
          phone: "",
          is_admin: false,
          is_designer: false,
          is_project_manager: false,
          can_request_payment: false,
        },
      },
      sortKey: "", // 當前排序欄位
      sortDirection: "asc", // 排序方向，asc 升序，desc 降序
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
    deleteUser(userId) {
      if (confirm("確定要刪除此用戶嗎？")) {
        fetch(`/users/api/${userId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              'input[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then(() => {
            this.fetchUsers(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
    },
    editUser(user) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editUserId = user.id;

      // 填充表單數據
      this.newUser = {
        username: user.username,
        email: user.email,
        firstName: user.first_name ? user.profile.name.split(" ")[0] : "",
        lastName: user.last_name ? user.profile.name.split(" ")[1] || "" : "",
        password: "*****",
        passwordConfirm: "*****",
        profile: {
          phone: user.profile.phone || "",
          is_admin: user.profile.is_admin || false,
          is_designer: user.profile.is_designer || false,
          is_project_manager: user.profile.is_project_manager || false,
          can_request_payment: user.profile.can_request_payment || false,
        },
      };

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addUserModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    },
    fetchUsers(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/users/api?format=json&page=${page}&page_size=${this.pageSize}`;

      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      if (this.roleFilter && this.roleFilter !== "all") {
        console.log(this.roleFilter);
        url += `&${this.roleFilter}=true`;
      }

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.users = data.results; // 假設後端返回 { results: [], count: X }
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching users:", error))
        .finally(() => {
          this.isLoading = false; // 無論成功或失敗，都將載入狀態設為 false
        });
    },
    toggleMenu(userId) {
      if (this.activeMenu === userId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120, // 向左偏移 60px
          y: rect.bottom + 10, // 向下偏移 10px
        };
        this.activeMenu = userId;
      }
      event.stopPropagation();
    },
    showAddUserModal() {
      this.showModal = true;
      this.isEditMode = false;
      this.editUserId = null;
      this.newUser = {
        username: "",
        email: "",
        firstName: "",
        lastName: "",
        password: "", // 新增密碼
        passwordConfirm: "", // 新增確認密碼
        profile: {
          // 改為物件管理多值角色
          phone: "",
          is_admin: false,
          is_designer: false,
          is_project_manager: false,
          can_request_payment: false,
        },
      };
      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addUserModal")
      );
      modal.show();
    },
    getMenuStyle(userId) {
      if (this.activeMenu !== userId) {
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
    getRoles(profile) {
      let roles = [];
      if (profile.is_admin) roles.push("管理員");
      if (profile.is_designer) roles.push("設計師");
      if (profile.is_project_manager) roles.push("專案經理");
      if (profile.can_request_payment) roles.push("請款");
      return roles;
    },
    getRolesText(profile) {
      let roles = [];
      if (profile.is_admin) roles.push("管理員");
      if (profile.is_designer) roles.push("設計師");
      if (profile.is_project_manager) roles.push("專案經理");
      if (can_request_payment) roles.push("請款");
      return roles;
    },
    getRoleBadgeClass(role) {
      if (role == "管理員") return "badge-light-danger";
      if (role == "設計師") return "badge-light-success";
      if (role == "專案經理") return "badge-light-primary";
      if (role == "請款") return "badge-light-warning";
      return "badge-light-warning";
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
    hideAddUserModal() {
      this.showModal = false;
      // 重置表單數據
      this.newUser = {
        username: "",
        email: "",
        password: "", // 新增密碼
        passwordConfirm: "", // 新增確認密碼
        profile: {
          // 改為物件管理多值角色
          phone: "",
          is_admin: false,
          is_designer: false,
          is_project_manager: false,
          can_request_payment: false,
        },
      };
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addUserModal")
      );
      modal.hide();
    },
    submitUserForm() {
      const formData = {
        username: this.newUser.username,
        email: this.newUser.email,
        first_name: this.newUser.firstName,
        last_name: this.newUser.lastName,
        password: this.newUser.password,
        password_confirm: this.newUser.passwordConfirm,
        profile: {
          // 改為物件管理多值角色
          name: `${this.newUser.firstName} ${this.newUser.lastName}`,
          phone: this.newUser.profile.phone,
          is_admin: this.newUser.profile.is_admin,
          is_designer: this.newUser.profile.is_designer,
          is_project_manager: this.newUser.profile.is_project_manager,
          can_request_payment: this.newUser.profile.can_request_payment,
        },
      };

      // if (this.newUser.password != "*****") {
      //   if (
      //     this.newUser.password &&
      //     this.newUser.password.length > 8 &&
      //     this.newUser.password === this.newUser.passwordConfirm
      //   ) {
      //     formData.password = this.newUser.password;
      //     formData.password_confirm = this.newUser.passwordConfirm;
      //   }
      // }

      const url = this.isEditMode
        ? `/users/api/${this.editUserId}/`
        : "/users/api/";
      const method = this.isEditMode ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(formData),
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(
              this.isEditMode ? "更新使用者失敗" : "創建使用者失敗"
            );
          return response.json();
        })
        .then(() => {
          this.hideAddUserModal(); // 提交成功後關閉 Modal
          this.fetchUsers(this.currentPage); // 刷新使用者列表
        })
        .catch((error) => {
          console.error("Error creating user:", error);
          alert(
            this.isEditMode
              ? "更新使用者失敗，請稍後再試"
              : "創建使用者失敗，請稍後再試"
          );
        });
    },
    // 處理每頁數量變更
    pageSizeChanged() {
      this.currentPage = 1; // 更改每頁數量時重置為第一頁
      this.fetchUsers(1);
    },
  },
  watch: {},
  mounted() {
    this.fetchUsers();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
