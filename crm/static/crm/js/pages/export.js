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
        await this.downloadFile('/crm/api/projects/export/', 'projects', '專案資料');
        this.showSuccessMessage('專案資料匯出成功');
        this.fetchExportHistory();
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
        await this.downloadFile('/crm/api/owners/export/', 'owners', '業主資料');
        this.showSuccessMessage('業主資料匯出成功');
        this.fetchExportHistory();
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
        await this.downloadFile('/crm/api/payments/export/', 'payments', '請款資料');
        this.showSuccessMessage('請款資料匯出成功');
        this.fetchExportHistory();
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
        await this.downloadFile('/crm/api/invoices/export/', 'invoices', '發票資料');
        this.showSuccessMessage('發票資料匯出成功');
        this.fetchExportHistory();
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
        await this.downloadFile('/crm/api/quotations/export/', 'quotations', '報價資料');
        this.showSuccessMessage('報價資料匯出成功');
        this.fetchExportHistory();
      } catch (error) {
        this.showErrorMessage('報價資料匯出失敗', error);
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
        await this.downloadFile('/crm/api/export/all/', 'all_data', '綜合報表');
        this.showSuccessMessage('綜合報表匯出成功');
        this.fetchExportHistory();
      } catch (error) {
        this.showErrorMessage('綜合報表匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 下載檔案的通用方法
     */
    async downloadFile(url, filename, displayName) {
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
        let downloadFilename = filename;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch) {
            downloadFilename = filenameMatch[1].replace(/['"]/g, '');
          }
        }

        // 如果沒有副檔名，加上 .xlsx
        if (!downloadFilename.includes('.')) {
          downloadFilename += `_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        const blob = await response.blob();
        
        // 創建下載連結
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        // 記錄匯出歷史
        this.addExportRecord({
          type: filename,
          type_display: displayName,
          file_size: this.formatFileSize(blob.size),
          status: 'completed',
          status_display: '已完成',
          created_at: new Date().toLocaleString('zh-TW'),
          file_url: downloadUrl
        });

        return response;
      } catch (error) {
        console.error('Download error:', error);
        throw error;
      }
    },

    /**
     * 獲取匯出歷史記錄
     */
    async fetchExportHistory() {
      try {
        // 這裡可以從 localStorage 或 API 獲取歷史記錄
        const history = localStorage.getItem('exportHistory');
        if (history) {
          this.exportHistory = JSON.parse(history);
        }
      } catch (error) {
        console.error('Failed to fetch export history:', error);
      }
    },

    /**
     * 添加匯出記錄
     */
    addExportRecord(record) {
      record.id = Date.now();
      this.exportHistory.unshift(record);
      
      // 只保留最近 10 條記錄
      if (this.exportHistory.length > 10) {
        this.exportHistory = this.exportHistory.slice(0, 10);
      }
      
      // 保存到 localStorage
      localStorage.setItem('exportHistory', JSON.stringify(this.exportHistory));
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
     * 獲取類型標籤樣式
     */
    getTypeBadgeClass(type) {
      const typeClassMap = {
        'projects': 'badge-light-primary',
        'owners': 'badge-light-success',
        'payments': 'badge-light-warning',
        'invoices': 'badge-light-info',
        'quotations': 'badge-light-danger',
        'all_data': 'badge-light-dark'
      };
      return typeClassMap[type] || 'badge-light-secondary';
    },

    /**
     * 獲取狀態標籤樣式
     */
    getStatusBadgeClass(status) {
      const statusClassMap = {
        'completed': 'badge-light-success',
        'processing': 'badge-light-warning',
        'failed': 'badge-light-danger'
      };
      return statusClassMap[status] || 'badge-light-secondary';
    },

    /**
     * 直接下載檔案（用於歷史記錄）
     */
    downloadFileFromHistory(fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    this.fetchExportHistory();
  }
});

// 掛載 Vue 應用到正確的容器
exportApp.mount('#export_list');
