/* DOM に依存しない集計。コメントIDは配信枠ごとに識別する。 */
(function (root) {
  class Counter {
    constructor(serviceId = '') {
      this.serviceId = serviceId;
      this.comments = 0;
      this.viewers = null;
      this.seen = new Set();
      this.initialComments = true;
    }
    accept(id) { return !this.serviceId || String(id) === this.serviceId; }
    services(services) {
      if (!Array.isArray(services)) return null;
      if (!this.serviceId) {
        const selected = services.find(s => s.enabled);
        if (selected) this.serviceId = String(selected.id);
      }
      const selected = services.find(s => String(s.id) === this.serviceId);
      if (!selected || selected.enabled === false) return this.viewer(null);
      return this.viewer(selected.meta?.viewer);
    }
    meta(payload) {
      const service = payload?.service;
      if (!service?.id || service.enabled === false) return null;
      if (!this.serviceId) this.serviceId = String(service.id);
      if (!this.accept(service.id)) return null;
      if (!Object.hasOwn(payload.data || {}, 'viewer')) return null;
      return this.viewer(payload.data.viewer);
    }
    viewer(value) {
      const parsed = typeof value === 'number' ? value :
        typeof value === 'string' && /^\d+(,\d{3})*$/.test(value.trim()) ? Number(value.replaceAll(',', '')) : NaN;
      const next = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
      const previous = this.viewers;
      this.viewers = next;
      // 初回取得・取得不能・復帰は増減通知にしない。
      return previous !== null && next !== null && next !== previous ? (next > previous ? 'up' : 'down') : null;
    }
    receive(comments) {
      if (!Array.isArray(comments)) return null;
      let added = 0;
      for (const comment of comments) {
        // OneSDK Comment.id は配信枠ID、Comment.data.id はコメントID。
        if (!this.serviceId && comment.id) this.serviceId = String(comment.id);
        if (!this.accept(comment.id)) continue;
        const id = comment.data?.id;
        if (id === undefined || id === null) continue;
        const key = JSON.stringify([comment.id, String(id)]);
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        added++;
      }
      this.comments += added;
      const notify = !this.initialComments && added > 0;
      this.initialComments = false;
      return notify ? 'comment' : null;
    }
    clear() {
      this.comments = 0;
      this.seen.clear();
      this.initialComments = false;
    }
  }
  if (typeof module !== 'undefined') module.exports = Counter;
  else root.OverlayCounter = Counter;
})(globalThis);
