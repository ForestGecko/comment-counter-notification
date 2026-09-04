const app = Vue.createApp({
  setup() {
    document.body.removeAttribute('hidden')
  },

  data() {
    return {
      commentCount: 0,
      commentText: '',
      showNotification: false,
      hideTimer: null,
    }
  },

  mounted() {
    let cache = new Map()
    let commentIndex = 0

    OneSDK.setup({
      permissions: OneSDK.usePermission([OneSDK.PERM.COMMENT]),
    })

    OneSDK.subscribe({
      action: 'comments',

      callback: (comments) => {
        const newCache = new Map()
        let newComments = 0
        let latestComment = null

        comments.forEach((comment) => {
          const id = comment.data.id
          const index = cache.get(id)

          if (isNaN(index)) {
            comment.commentIndex = commentIndex
            newCache.set(id, commentIndex)
            commentIndex++
            newComments++

            // 新しいコメントを保存
            latestComment = comment
          } else {
            comment.commentIndex = index
            newCache.set(id, index)
          }
        })

        cache = newCache

        // 新しいコメントがなければ何もしない
        if (newComments === 0 || latestComment === null) {
          return
        }

        // 累計コメント数
        this.commentCount += newComments

        // コメント本文を取得
        const text = latestComment.data.comment || ''

        // 15文字まで表示
        const characters = Array.from(text)

        if (characters.length > 15) {
          this.commentText =
            characters.slice(0, 15).join('') + '...'
        } else {
          this.commentText = text
        }

        // 通知を表示
        this.showNotification = true

        // 前回のタイマーを解除
        if (this.hideTimer !== null) {
          clearTimeout(this.hideTimer)
        }

        // 3秒後に消す
        this.hideTimer = setTimeout(() => {
          this.showNotification = false
          this.hideTimer = null
        }, 3000)
      },
    })

    OneSDK.connect()
  },
})

OneSDK.ready().then(() => {
  app.mount('#container')
})