const importApp = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      isLoading: false,
      importHistory: [],
      activeMenu: null,
      selectedFile: null,
      uploadProgress: 0
    };
  },
  methods: {
    /**
     * 匯入專案資料
     */
    async importProjects() {
      try {
        this.isLoading = true;
        const fileInput = await this.selectFile('選擇專案資料檔案', '.csv,.xlsx');
        if (fileInput) {
          await this.uploadFile('/crm/api/import/projects/', fileInput);
          // showImportResult 已經在 uploadFile 中呼叫
        } else {
          // 使用者取消檔案選取
          this.isLoading = false;
          return;
        }
      } catch (error) {
        this.showErrorMessage('專案資料匯入失敗', error);
      } finally {
        this.isLoading = false;
      }
    },
    /**
     * 匯入業主資料
     */
    async importOwners() {
      try {
        this.isLoading = true;
        const fileInput = await this.selectFile('選擇業主資料檔案', '.csv,.xlsx');
        if (fileInput) {
          await this.uploadFile('/crm/api/import/owners/', fileInput);
          // showImportResult 已經在 uploadFile 中呼叫
        } else {
          // 使用者取消檔案選取
          this.isLoading = false;
          return;
        }
      } catch (error) {
        this.showErrorMessage('業主資料匯入失敗', error);
      } finally {
        this.isLoading = false;
      }
    },
    /**
     * 選擇檔案
     */
    selectFile(title, accept) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.title = title;

        input.onchange = (event) => {
          const file = event.target.files[0];
          if (file) {
            this.selectedFile = file;
            resolve(file);
          } else {
            resolve(null);
          }
        };

        // 處理取消選取的情況
        input.oncancel = () => {
          resolve(null);
        };

        // 監聽 window focus 事件來處理用戶取消選取檔案的情況
        const handleFocus = () => {
          setTimeout(() => {
            if (!input.files || input.files.length === 0) {
              resolve(null);
            }
            window.removeEventListener('focus', handleFocus);
          }, 300);
        };

        window.addEventListener('focus', handleFocus);
        input.click();
      });
    },
    /**
     * 上傳檔案
     */
    async uploadFile(url, file) {
      const formData = new FormData();
      formData.append('file', file);

      // 取得CSRF token
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      if (csrfToken) {
        formData.append('csrfmiddlewaretoken', csrfToken);
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRFToken': csrfToken
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // 顯示詳細的匯入結果（包含成功、錯誤和警告）
      this.showImportResult(result);

      return result;
    },
    /**
     * 顯示成功訊息
     */
    showSuccessMessage(message) {
      Swal.fire({
        icon: 'success',
        title: '成功',
        text: message,
        timer: 3000,
        showConfirmButton: false
      });
    },    /**
     * 顯示匯入結果詳情
     */
    showImportResult(result) {
      const messages = [];
      
      // 處理匯入結果 - 適應不同的資料結構
      if (result.success === false) {
        // 匯入完全失敗
        this.showErrorMessage('匯入失敗', { message: result.message || result.error || '匯入過程中發生錯誤' });
        return;
      }
      
      // 支援兩種資料結構：result.data 或 result.result
      const importData = result.data || result.result;
      
      if (importData && importData.success_count > 0) {
        messages.push(`成功匯入 ${importData.success_count} 筆資料`);
      }
      
      if (importData && importData.error_count > 0) {
        messages.push(`失敗 ${importData.error_count} 筆資料`);
      }
      
      if (importData && importData.warning_count > 0) {
        messages.push(`警告 ${importData.warning_count} 筆資料`);
      }
      
      // 如果沒有任何訊息，顯示基本成功訊息
      if (messages.length === 0) {
        messages.push('匯入完成');
      }
      
      let html = messages.join('<br>');
      
      // 顯示錯誤和警告詳情
      if (importData && (importData.errors?.length > 0 || importData.warnings?.length > 0)) {
        html += '<hr>';
        
        if (importData.errors && importData.errors.length > 0) {
          html += '<div class="text-danger"><strong>錯誤詳情：</strong><br>';
          importData.errors.forEach(error => {
            html += `第 ${error.row} 行: ${error.message}<br>`;
          });
          html += '</div>';
        }
        
        if (importData.warnings && importData.warnings.length > 0) {
          html += '<div class="text-warning"><strong>警告詳情：</strong><br>';
          importData.warnings.forEach(warning => {
            html += `第 ${warning.row} 行: ${warning.message}<br>`;
          });
          html += '</div>';
        }
      }
      
      // 決定顯示的圖示
      let icon = 'success';
      if (importData && importData.error_count > 0) {
        icon = importData.success_count > 0 ? 'warning' : 'error';
      }
      
      // 決定標題和按鈕文字
      let title = '匯入完成';
      let confirmButtonText = '確定';
      
      if (importData) {
        if (importData.success_count > 0 && importData.error_count === 0) {
          title = '匯入成功';
        } else if (importData.error_count > 0) {
          title = importData.success_count > 0 ? '部分匯入成功' : '匯入失敗';
        }
      }
      
      Swal.fire({
        icon: icon,
        title: title,
        html: html,
        confirmButtonText: confirmButtonText,
        customClass: {
          container: importData?.error_count > 0 ? 'import-error-dialog' : 'import-success-dialog'
        }
      });
    },

    /**
     * 顯示錯誤訊息
     */
    showErrorMessage(title, error) {
      console.error('Import error:', error);
      Swal.fire({
        icon: 'error',
        title: title,
        text: error.message || '發生未知錯誤',
        confirmButtonText: '確定'
      });
    },

    /**
     * 格式化檔案大小
     */
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 驗證檔案格式
     */
    validateFileFormat(file, allowedExtensions) {
      const fileName = file.name.toLowerCase();
      const isValidFormat = allowedExtensions.some(ext => fileName.endsWith(ext));

      if (!isValidFormat) {
        throw new Error(`不支援的檔案格式。支援的格式：${allowedExtensions.join(', ')}`);
      }

      return true;
    },

    /**
     * 驗證檔案大小
     */
    validateFileSize(file, maxSizeMB = 10) {
      const maxSize = maxSizeMB * 1024 * 1024; // 轉換為bytes

      if (file.size > maxSize) {
        throw new Error(`檔案大小超過限制。最大允許大小：${maxSizeMB}MB`);
      }

      return true;
    }
  },

  mounted() {
    console.log('Import page initialized');
  }
});

// 掛載Vue應用程式
importApp.mount('#import_list');
