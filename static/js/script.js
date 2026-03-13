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

    function handleUpload(file) {
        if (!file) return;

        const connector = document.querySelector('.connector-line');
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

        const formData = new FormData();
        formData.append('file', file);

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        fetch(`/geckoshare?code=${code}`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                window.location.reload();
            } else {
                alert('Upload failed');
                resetUI();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Upload error');
            resetUI();
        });
    }

    function resetUI() {
        if (uploadAnimation) {
            uploadAnimation.pause();
            uploadAnimation.style.display = 'none';
        }
        if (geckoImage) geckoImage.style.display = 'block';
        
        const connector = document.querySelector('.connector-line');
        if (connector) connector.classList.remove('uploading');
    }

    socket.on('file_uploaded', function(data) {
        window.location.reload();
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

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile && !sessionStorage.getItem('shareOpened')) {
        setTimeout(toggleShare, 1000);
        sessionStorage.setItem('shareOpened', 'true');
    }

    window.deleteFile = function(filename) {
        if (confirm(`Delete ${filename}?`)) {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            fetch(`/delete/${encodeURIComponent(filename)}?code=${code}`, {
                method: 'POST'
            })
            .then(response => {
                if (response.ok) {
                    // socket will handle reload
                } else {
                    alert('Delete failed');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Delete error');
            });
        }
    };
});
