document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const connectionCountEl = document.getElementById('connection-count');

    let deviceId = localStorage.getItem('gecko_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('gecko_device_id', deviceId);
    }

    function getDeviceInfo() {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) return "Android Phone";
        if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone/iPad";
        if (/Windows/i.test(ua)) return "Windows PC";
        if (/Mac/i.test(ua)) return "MacBook/Mac";
        if (/Linux/i.test(ua)) return "Linux System";
        return "Unknown Device";
    }

    socket.on('update_connections', (data) => {
        if (connectionCountEl) {
            connectionCountEl.textContent = `${data.count} Gecko Device${data.count !== 1 ? 's' : ''} Connected Right now`;
        }
    });

    socket.on('connect', () => {
        console.log('Socket connected, registering device...');
        socket.emit('register_device', { 
            device_id: deviceId,
            device_info: getDeviceInfo()
        });
        socket.emit('request_count');
    });

    const geckoImage = document.getElementById('geckoImage');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');

    const IMAGE_OPENED = '/assets/gecko_mouth_opened.png';
    const IMAGE_CLOSED = '/assets/gecko_mouth_notopened.png';
    // Drag and Drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            if (geckoImage) geckoImage.src = IMAGE_OPENED;
        }, false);
    });

    // Hover events for Gecko
    const geckoBox = document.querySelector('.gecko-box');
    if (geckoBox) {
        geckoBox.addEventListener('mouseenter', () => {
            if (geckoImage) geckoImage.src = IMAGE_OPENED;
        });
        geckoBox.addEventListener('mouseleave', () => {
            if (geckoImage) geckoImage.src = IMAGE_CLOSED;
        });
    }

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            if (eventName === 'drop') {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files && files.length > 0) {
                    handleUpload(files[0]);
                }
            }
            if (geckoImage) geckoImage.src = IMAGE_CLOSED;
        }, false);
    });

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleUpload(fileInput.files[0]);
            }
        });
    }

    const uploadAnimation = document.getElementById('uploadAnimation');
    let currentXhr = null;

    // We'll manage the cancel listener inside handleUpload for specific context

    function handleUpload(file) {
        if (!file) return;

        // Dynamic cancel listener with file context for cleanup
        const cancelBtn = document.getElementById('cancelUploadBtn');
        if (cancelBtn) {
            // Remove old listener and add fresh one for this specific file
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                if (currentXhr) {
                    currentXhr.abort();
                    // Immediate refresh as requested
                    window.location.reload();
                }
            });
        }

        const connector = document.querySelector('.connector-line');
        const statsEl = document.getElementById('uploadStats');
        const promptEl = document.getElementById('dropPrompt');
        const speedEl = document.getElementById('uploadSpeed');
        const progressEl = document.getElementById('uploadProgress');
        const textInputGroup = document.getElementById('textInputGroup');

        if (textInputGroup) textInputGroup.style.setProperty('display', 'none', 'important');

        if (connector) {
            connector.style.display = 'block';
            connector.classList.add('uploading');
        }
        
        if (geckoImage) geckoImage.style.display = 'none';
        if (uploadAnimation) {
            uploadAnimation.style.display = 'block';
            uploadAnimation.currentTime = 0;
            uploadAnimation.play();
            uploadAnimation.ontimeupdate = () => {
                if (uploadAnimation.currentTime >= 5) {
                    uploadAnimation.currentTime = 3;
                }
            };
        }

        // Show stats, hide prompt
        if (statsEl) statsEl.style.display = 'flex';
        if (promptEl) promptEl.style.display = 'none';

        const formData = new FormData();
        formData.append('file', file);

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        currentXhr = new XMLHttpRequest();
        let startTime = Date.now();

        currentXhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const now = Date.now();
                const duration = (now - startTime) / 1000;
                if (duration > 0) {
                    const speed = e.loaded / duration;
                    if (speedEl) speedEl.innerHTML = `<b>${formatSize(speed)}/s</b>`;
                }
                if (progressEl) progressEl.innerHTML = `<b>${formatSize(e.loaded)} / ${formatSize(e.total)}</b>`;
            }
        });

        currentXhr.onreadystatechange = () => {
            if (currentXhr.readyState === 4) {
                if (currentXhr.status === 200) {
                    window.location.reload();
                } else if (currentXhr.status !== 0) { // Status 0 means aborted
                    alert('Upload failed');
                    resetUI();
                }
            }
        };

        currentXhr.open('POST', `/geckoshare?code=${code}`, true);
        currentXhr.send(formData);
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function resetUI() {
        if (uploadAnimation) {
            uploadAnimation.pause();
            uploadAnimation.style.display = 'none';
        }
        if (geckoImage) geckoImage.style.display = 'block';
        
        const statsEl = document.getElementById('uploadStats');
        const promptEl = document.getElementById('dropPrompt');
        if (statsEl) statsEl.style.display = 'none';
        if (promptEl) promptEl.style.display = 'block';

        const textInputGroup = document.getElementById('textInputGroup');
        if (textInputGroup) textInputGroup.style.setProperty('display', 'flex', 'important');

        const connector = document.querySelector('.connector-line');
        if (connector) {
            connector.classList.remove('uploading');
            connector.style.display = 'none'; // Ensure it's hidden
        }
    }

    socket.on('file_uploaded', function(data) {
        if (data.action === 'delete') {
            // Find and remove the specific file card
            const cards = document.querySelectorAll('.file-card');
            cards.forEach(card => {
                const deleteBtn = card.querySelector('.delete-btn');
                // Check if onclick contains the filename
                if (deleteBtn && deleteBtn.getAttribute('onclick').includes("'" + data.filename + "'")) {
                    // Stop media before removal
                    const media = card.querySelector('.media-preview');
                    if (media) {
                        if (media.tagName === 'VIDEO') {
                            media.pause();
                            media.src = "";
                            media.load();
                        }
                    }
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        card.remove();
                        // Check if grid is empty after removal
                        const grid = document.getElementById('fileGrid');
                        if (grid && grid.querySelectorAll('.file-card').length === 0) {
                            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim);">No files shared yet. Feed the gecko!</p>';
                        }
                    }, 300);
                }
            });
        } else {
            window.location.reload();
        }
    });

    function getIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const baseUrl = 'https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/master/icons/';
        
        const iconMap = {
            'pdf': 'pdf.svg',
            'doc': 'word.svg',
            'docx': 'word.svg',
            'xls': 'excel.svg',
            'xlsx': 'excel.svg',
            'csv': 'excel.svg',
            'ppt': 'powerpoint.svg',
            'pptx': 'powerpoint.svg',
            'zip': 'zip.svg',
            'rar': 'zip.svg',
            '7z': 'zip.svg',
            'txt': 'document.svg',
            'js': 'javascript.svg',
            'html': 'html.svg',
            'css': 'css.svg',
            'py': 'python.svg',
            'json': 'json.svg',
            'mp3': 'audio.svg',
            'wav': 'audio.svg',
            'exe': 'exe.svg',
            'dmg': 'exe.svg'
        };
        
        return baseUrl + (iconMap[ext] || 'file.svg');
    }

    const btnOriginal = document.getElementById('btnOriginal');
    const btnFixed = document.getElementById('btnFixed');
    const fileGrid = document.getElementById('fileGrid');

    function setLayout(layout) {
        if (layout === 'fixed') {
            fileGrid.classList.add('is-fixed');
            btnFixed.classList.add('active');
            btnOriginal.classList.remove('active');
            
            // Apply truncation to all files
            document.querySelectorAll('.file-name').forEach(el => {
                el.textContent = el.getAttribute('data-display-name');
            });
        } else {
            fileGrid.classList.remove('is-fixed');
            btnOriginal.classList.add('active');
            btnFixed.classList.remove('active');

            // Show full names for all files
            document.querySelectorAll('.file-name').forEach(el => {
                const fullName = el.getAttribute('data-full-name');
                const displayName = el.getAttribute('data-display-name');
                const ext = displayName.includes('.') ? '.' + displayName.split('.').pop() : '';
                el.textContent = fullName + ext;
            });
        }
        localStorage.setItem('library-layout', layout);
    }

    if (btnOriginal && btnFixed && fileGrid) {
        btnOriginal.addEventListener('click', () => setLayout('original'));
        btnFixed.addEventListener('click', () => setLayout('fixed'));

        // Load preference
        const savedLayout = localStorage.getItem('library-layout');
        if (savedLayout) setLayout(savedLayout);
    }

    document.querySelectorAll('.file-type-icon').forEach(el => {
        const filename = el.getAttribute('data-filename');
        el.src = getIcon(filename);
    });

    function detectOrientation(el, card) {
        if (el.tagName === 'IMG') {
            if (el.complete) {
                checkRatio();
            } else {
                el.onload = checkRatio;
            }
        } else if (el.tagName === 'VIDEO') {
            el.onloadedmetadata = checkRatio;
        }

        function checkRatio() {
            const width = el.naturalWidth || el.videoWidth;
            const height = el.naturalHeight || el.videoHeight;
            if (height > width) {
                card.classList.add('is-portrait');
            } else if (width > height) {
                card.classList.add('is-landscape');
            } else {
                card.classList.add('is-square');
            }
        }
    }
    document.querySelectorAll('.file-card').forEach(card => {
        const media = card.querySelector('.media-preview');
        if (media) {
            detectOrientation(media, card);
            
            if (media.tagName === 'VIDEO') {
                const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                if (isMobileDevice) {
                    media.preload = "metadata";
                    
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                media.play().catch(() => {});
                            } else {
                                media.pause();
                            }
                        });
                    }, { threshold: 0.5 });
                    
                    observer.observe(media);
                } else {
                    card.addEventListener('mouseenter', () => {
                        if (media.readyState < 3) media.load();
                        media.play().catch(() => {});
                    });
                    card.addEventListener('mouseleave', () => {
                        media.pause();
                    });
                }
            }
        }

        const nameEl = card.querySelector('.file-name');
        if (nameEl) {
            const fullName = nameEl.getAttribute('data-full-name');
            const displayName = nameEl.getAttribute('data-display-name');
            const ext = displayName.includes('.') ? '.' + displayName.split('.').pop() : '';

            card.addEventListener('mouseenter', () => {
                if (fileGrid.classList.contains('is-fixed')) {
                    nameEl.textContent = fullName + ext;
                }
            });
            card.addEventListener('mouseleave', () => {
                if (fileGrid.classList.contains('is-fixed')) {
                    nameEl.textContent = displayName;
                }
            });
        }
    });

    const shareBtn = document.getElementById('shareBtn');
    const shareOverlay = document.getElementById('shareOverlay');
    const shareUrlInput = document.getElementById('shareUrl');

    window.toggleShare = function() {
        shareOverlay.classList.add('active');
    };

    window.closeShare = function() {
        shareOverlay.classList.remove('active');
    };

    window.copyLink = function() {
        const copyBtn = document.getElementById('copyBtn');
        shareUrlInput.select();
        shareUrlInput.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(shareUrlInput.value).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#E2FF76';
            copyBtn.style.color = '#222';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
                copyBtn.style.color = '';
            }, 2000);
        });
    };

    if (shareBtn) shareBtn.addEventListener('click', toggleShare);

    const sendTextBtn = document.getElementById('sendTextBtn');
    const mobileTextInput = document.getElementById('mobileTextInput');

    if (sendTextBtn && mobileTextInput) {
        sendTextBtn.addEventListener('click', () => {
            const text = mobileTextInput.value.trim();
            if (text) {
                handleTextPaste(text);
                mobileTextInput.value = '';
            }
        });

        // Allow Ctrl+Enter to send
        mobileTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                sendTextBtn.click();
            }
        });
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile && !sessionStorage.getItem('shareOpened')) {
        setTimeout(toggleShare, 1000);
        sessionStorage.setItem('shareOpened', 'true');
    }

    window.deleteFile = function(filename) {
        if (confirm(`Delete ${filename}?`)) {
            // UI-First Deletion: Find the card and remove it immediately
            const cards = document.querySelectorAll('.file-card');
            let targetCard = null;
            
            cards.forEach(card => {
                const deleteBtn = card.querySelector('.delete-btn');
                if (deleteBtn && deleteBtn.getAttribute('onclick').includes("'" + filename + "'")) {
                    targetCard = card;
                }
            });

            if (targetCard) {
                // 1. Release file handles (crucial for Windows)
                const media = targetCard.querySelector('.media-preview');
                if (media) {
                    if (media.tagName === 'VIDEO') {
                        media.pause();
                        media.src = ""; // Clear source to release lock
                        media.load();
                    }
                }
                
                // 2. Animate and remove from UI
                targetCard.style.opacity = '0';
                targetCard.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    targetCard.remove();
                    // Show empty message if last file
                    const grid = document.getElementById('fileGrid');
                    if (grid && grid.querySelectorAll('.file-card').length === 0) {
                        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim);">No files shared yet. Feed the gecko!</p>';
                    }
                }, 300);
            }

            // 3. Request server to delete
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            fetch(`/delete/${encodeURIComponent(filename)}?code=${code}`, {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    console.error('Server deletion failed');
                }
            })
            .catch(error => {
                console.error('Delete error:', error);
            });
        }
    };

    // Paste handling
    window.addEventListener('paste', (e) => {
        // Don't trigger if user is typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (text) {
            handleTextPaste(text);
        }
    });

    function handleTextPaste(text) {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        // Trigger Gecko mouth animation
        if (geckoImage) geckoImage.src = IMAGE_OPENED;
        const connector = document.querySelector('.connector-line');
        if (connector) {
            connector.style.display = 'block';
            connector.classList.add('uploading');
        }

        fetch(`/paste?code=${code}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        })
        .then(response => {
            if (response.ok) {
                // Socket will handle reload
            } else {
                alert('Paste failed');
                resetUI();
            }
        })
        .catch(err => {
            console.error('Paste error:', err);
            resetUI();
        });
    }

    window.copyTextFromElement = function(btn) {
        const container = btn.closest('.text-preview-container');
        const text = container.getAttribute('data-full-text');
        
        if (!text) {
            alert('No text content found');
            return;
        }

        const notifySuccess = () => {
            const originalContent = btn.innerHTML;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
            `;
            btn.style.background = '#E2FF76';
            btn.style.color = '#222';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.style.background = '';
                btn.style.color = '';
            }, 2000);
        };

        // Modern Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(notifySuccess)
                .catch(err => {
                    console.error('Clipboard API failed:', err);
                    fallbackCopy(text, notifySuccess);
                });
        } else {
            fallbackCopy(text, notifySuccess);
        }
    };

    function fallbackCopy(text, successCallback) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                successCallback();
            } else {
                alert('Could not copy text (fallback failed)');
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            alert('Could not copy text');
        }
    }
});
