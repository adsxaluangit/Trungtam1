module.exports = () => ({
    // Disable i18n plugin entirely - this is a Vietnamese-only app
    i18n: {
        enabled: false,
    },
    'users-permissions': {
        config: {
            ratelimit: {
                interval: 60000,
                max: 100,
            },
        },
    },
    // Tắt tạo ảnh thumbnail tự động — tiết kiệm ổ đĩa
    // Mặc định Strapi tạo 4 kích thước: thumbnail, small, medium, large
    // Sau khi tắt: chỉ lưu ảnh gốc duy nhất
    upload: {
        config: {
            breakpoints: {}, // Tắt hoàn toàn — không tạo thumbnail/small/medium/large
        },
    },
});

