const exportApp = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      isLoading: false,
      exportHistory: [],
      activeMenu: null
    };
  },
  methods: {
    /**
     * 匯出專案資料
     */
    async exportProjects() {
      try {
        this.isLoading = true;
        await this.downloadFile('/crm/export/projects/csv/');
        this.showSuccessMessage('專案資料匯出成功');
      } catch (error) {
        this.showErrorMessage('專案資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出業主資料
     */
    async exportOwners() {
      try {
        this.isLoading = true;
        await this.downloadFile('/crm/export/owners/csv/');
        this.showSuccessMessage('業主資料匯出成功');
      } catch (error) {
        this.showErrorMessage('業主資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出請款資料
     */
    async exportPayments() {
      try {
        this.isLoading = true;
        await this.downloadFile('/crm/export/payments/csv/');
        this.showSuccessMessage('請款資料匯出成功');
      } catch (error) {
        this.showErrorMessage('請款資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出發票資料
     */
    async exportInvoices() {
      try {
        this.isLoading = true;
        await this.downloadFile('/crm/export/invoices/csv/');
        this.showSuccessMessage('發票資料匯出成功');
      } catch (error) {
        this.showErrorMessage('發票資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出報價資料
     */
    async exportQuotations() {
      try {
        this.isLoading = true;
        await this.downloadFile('/crm/export/quotations/csv/');
        this.showSuccessMessage('報價資料匯出成功');
      } catch (error) {
        this.showErrorMessage('報價資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出案件類別資料
     */
    async exportCategories() {
      try {
        this.isLoading = true;
        await this.downloadFile('/crm/export/categories/csv/');
        this.showSuccessMessage('案件類別資料匯出成功');
      } catch (error) {
        this.showErrorMessage('案件類別資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出所有資料
     */
    async exportAll() {
      try {
        this.isLoading = true;
        
        // 依次匯出所有資料類型
        const exportTasks = [
          { method: this.exportProjects, name: '專案資料' },
          { method: this.exportOwners, name: '業主資料' },
          { method: this.exportQuotations, name: '報價資料' },
          { method: this.exportPayments, name: '請款資料' },
          { method: this.exportInvoices, name: '發票資料' },
          { method: this.exportCategories, name: '案件類別資料' }
        ];

        for (const task of exportTasks) {
          await task.method.call(this);
          // 在每次匯出之間稍作停頓，避免同時下載過多檔案
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.showSuccessMessage('所有資料匯出完成');
      } catch (error) {
        this.showErrorMessage('匯出過程中發生錯誤', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 下載檔案的通用方法
     */
    async downloadFile(url) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 取得檔案名稱（如果有的話）
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `export_${new Date().toISOString().split('T')[0]}.csv`;
        
        if (contentDisposition) {
          // 首先嘗試解析 UTF-8 編碼的檔案名稱
          const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
          if (utf8Match) {
            try {
              filename = decodeURIComponent(utf8Match[1]);
            } catch (e) {
              console.warn('Failed to decode UTF-8 filename:', e);
            }
          } else {
            // 如果沒有 UTF-8 編碼，則使用標準的 filename
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }
        }

        const blob = await response.blob();
        
        // 創建下載連結
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        return response;
      } catch (error) {
        console.error('Download error:', error);
        throw error;
      }
    },



    /**
     * 顯示成功訊息
     */
    showSuccessMessage(message) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: '匯出成功',
          text: message,
          timer: 3000,
          showConfirmButton: false
        });
      } else {
        alert(message);
      }
    },

    /**
     * 顯示錯誤訊息
     */
    showErrorMessage(message, error) {
      console.error(message, error);
      const errorText = error?.message || error || '未知錯誤';
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: '匯出失敗',
          text: `${message}: ${errorText}`,
          confirmButtonText: '確定'
        });
      } else {
        alert(`${message}: ${errorText}`);
      }
    }
  },

  mounted() {
    console.log('Export app mounted');
  }
});

// 掛載 Vue 應用到正確的容器
exportApp.mount('#export_list');
