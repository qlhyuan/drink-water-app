<template>
  <div class="cups">
    <header class="page-header">
      <van-icon name="arrow-left" size="20" @click="$router.back()" />
      <div class="title">杯型管理</div>
      <div style="width:20px"></div>
    </header>

    <!-- 默认杯型列表 -->
    <section class="block">
      <div class="section-title-row">
        <div class="section-title">默认杯型</div>
        <div class="section-desc">点击行进行操作</div>
      </div>

      <div class="list-card">
        <!-- 系统内置杯型 -->
        <div
          v-for="c in defaults"
          :key="c.id"
          class="list-item"
          :class="{ active: auth.user?.defaultCupId === c.id }"
          @click="openDrawer(c)"
        >
          <div class="item-emoji">{{ c.emoji }}</div>
          <div class="item-info">
            <div class="item-name">{{ c.name }}</div>
            <div class="item-cap">{{ c.capacity }} ml</div>
          </div>
          <div v-if="auth.user?.defaultCupId === c.id" class="default-tag">默认</div>
        </div>

        <!-- 自定义杯型 -->
        <div
          v-for="c in customs"
          :key="c.id"
          class="list-item"
          :class="{ active: auth.user?.defaultCupId === String(c.id) }"
          @click="openDrawer({ ...c, id: String(c.id) })"
        >
          <div class="item-emoji">{{ c.emoji }}</div>
          <div class="item-info">
            <div class="item-name">{{ c.name }} <span class="custom-tag">自定义</span></div>
            <div class="item-cap">{{ c.capacity }} ml</div>
          </div>
          <div v-if="auth.user?.defaultCupId === String(c.id)" class="default-tag">默认</div>
        </div>
      </div>

      <div class="add-btn" @click="openAddModal">
        <van-icon name="plus" size="16" />
        <span>添加自定义杯型</span>
      </div>

      <div class="block-hint">
        <van-icon name="info-o" size="11" />
        点击任意杯型可设为默认 / 编辑 / 删除；同一时间仅 1 个默认
      </div>
    </section>

    <!-- 操作抽屉（点击行触发） -->
    <van-popup
      v-model:show="showDrawer"
      position="bottom"
      round
      :style="{ background: 'transparent' }"
      close-on-click-overlay
    >
      <div class="drawer">
        <!-- 抽屉标题（展示当前杯型信息） -->
        <div v-if="drawerCup" class="drawer-header">
          <div class="drawer-emoji">{{ drawerCup.emoji }}</div>
          <div class="drawer-name">{{ drawerCup.name }}</div>
          <div class="drawer-cap">{{ drawerCup.capacity }} ml</div>
          <div v-if="isDrawerDefault" class="drawer-default-tag">当前默认</div>
        </div>

        <!-- 操作按钮 -->
        <div class="drawer-actions">
          <!-- 自定义杯型：显示全部三个按钮 -->
          <template v-if="drawerCup && !isSystemCup(drawerCup)">
            <button class="drawer-btn" @click="onEditFromDrawer">
              <van-icon name="edit" size="20" />
              <span>编辑杯型</span>
            </button>
            <button
              class="drawer-btn"
              :class="{ disabled: isDrawerDefault }"
              :disabled="isDrawerDefault"
              @click="onSetDefaultFromDrawer"
            >
              <van-icon :name="isDrawerDefault ? 'success' : 'plus'" size="20" />
              <span>{{ isDrawerDefault ? '已是默认' : '设为默认' }}</span>
            </button>
            <button class="drawer-btn drawer-btn-danger" @click="onDeleteFromDrawer">
              <van-icon name="delete-o" size="20" />
              <span>删除杯型</span>
            </button>
          </template>
          <!-- 系统杯型：只显示"设为默认" -->
          <template v-else-if="drawerCup">
            <button
              class="drawer-btn"
              :class="{ disabled: isDrawerDefault }"
              :disabled="isDrawerDefault"
              @click="onSetDefaultFromDrawer"
            >
              <van-icon :name="isDrawerDefault ? 'success' : 'plus'" size="20" />
              <span>{{ isDrawerDefault ? '已是默认' : '设为默认' }}</span>
            </button>
            <div class="drawer-tip">
              <van-icon name="info-o" size="12" />
              系统内置杯型不可编辑或删除
            </div>
          </template>
        </div>

        <!-- 取消按钮 -->
        <button class="drawer-cancel" @click="showDrawer = false">取消</button>
      </div>
    </van-popup>

    <!-- 添加/编辑杯型弹窗 -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="form-modal">
        <div class="form-close" @click="showForm = false">✕</div>
        <div class="form-title">{{ editTarget ? '编辑杯型' : '添加杯型' }}</div>

        <div class="form-group">
          <div class="form-label">选择图标</div>
          <div class="emoji-picker">
            <div
              v-for="e in emojiOptions"
              :key="e"
              class="emoji-option"
              :class="{ selected: form.emoji === e }"
              @click="form.emoji = e"
            >{{ e }}</div>
          </div>
        </div>

        <div class="form-group">
          <div class="form-label">杯型名称</div>
          <input
            v-model="form.name"
            class="form-input"
            type="text"
            placeholder="如：我的水壶"
            maxlength="16"
          />
        </div>

        <div class="form-group">
          <div class="form-label">容量（ml）</div>
          <input
            v-model.number="form.capacity"
            class="form-input"
            type="number"
            placeholder="如：350"
            min="50"
            max="3000"
          />
        </div>

        <button class="form-submit" @click="submitCup">
          {{ editTarget ? '保存修改' : '添加杯型' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { showToast, showConfirmDialog } from 'vant';
import { cupApi, userApi } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const defaults = ref([]);
const customs = ref([]);
const showForm = ref(false);
const editTarget = ref(null);
const emojiOptions = ['🥤', '☕', '🍵', '🍺', '🥛', '💧', '🧃', '🍹'];
const form = ref({ name: '', capacity: 250, emoji: '🥤' });

// 抽屉状态
const showDrawer = ref(false);
const drawerCup = ref(null);
const isDrawerDefault = computed(() =>
  drawerCup.value && auth.user?.defaultCupId === drawerCup.value.id,
);

const totalCount = computed(() => defaults.value.length + customs.value.length);

onMounted(loadCups);

async function loadCups() {
  const data = await cupApi.list();
  defaults.value = data.defaults;
  customs.value = data.customs;
}

// 判断是否系统杯型（id 是字符串 d1~d4）
function isSystemCup(cup) {
  return typeof cup.id === 'string' && /^d\d+$/.test(cup.id);
}

// 打开抽屉
function openDrawer(cup) {
  drawerCup.value = cup;
  showDrawer.value = true;
}

// 抽屉内按钮处理
function onEditFromDrawer() {
  if (!drawerCup.value) return;
  editCup(drawerCup.value);
  showDrawer.value = false;
}

async function onSetDefaultFromDrawer() {
  if (!drawerCup.value || isDrawerDefault.value) return;
  await setDefaultCup(drawerCup.value);
  showDrawer.value = false;
}

async function onDeleteFromDrawer() {
  if (!drawerCup.value) return;
  await showConfirmDialog({
    title: '删除杯型',
    message: `确定要删除「${drawerCup.value.name}」吗？`,
    confirmButtonText: '删除',
  });
  await removeCup(drawerCup.value.id);
  showDrawer.value = false;
}

// 表单相关
function openAddModal() {
  editTarget.value = null;
  form.value = { name: '', capacity: 250, emoji: '🥤' };
  showForm.value = true;
}

function editCup(cup) {
  editTarget.value = cup;
  form.value = { name: cup.name, capacity: cup.capacity, emoji: cup.emoji };
  showForm.value = true;
}

async function submitCup() {
  if (!form.value.name || !form.value.capacity) {
    showToast('请填写完整信息');
    return;
  }
  const payload = { name: form.value.name, capacity: Number(form.value.capacity), emoji: form.value.emoji };
  if (editTarget.value) {
    await cupApi.update(editTarget.value.id, payload);
    showToast('已修改');
  } else {
    await cupApi.add(payload);
    showToast('已添加');
  }
  form.value = { name: '', capacity: 250, emoji: '🥤' };
  editTarget.value = null;
  showForm.value = false;
  await loadCups();
}

async function removeCup(id) {
  await cupApi.remove(id);
  if (auth.user?.defaultCupId === String(id)) {
    const next = await userApi.update({ defaultCupId: null });
    auth.user = next;
  }
  await loadCups();
  showToast('已删除');
}

async function setDefaultCup(cup) {
  if (auth.user?.defaultCupId === cup.id) return;
  const next = await userApi.update({ defaultCupId: String(cup.id) });
  auth.user = next;
  showToast(`已将「${cup.name}」设为提醒默认`);
}
</script>

<style scoped>
.cups { padding: 0 0 80px; max-width: 720px; margin: 0 auto; background: var(--bg); min-height: 100vh; }
.page-header { display: flex; align-items: center; padding: 14px 16px; gap: 12px; background: white; }
.page-header .title { flex: 1; font-size: 16px; font-weight: 600; text-align: center; }

/* 区块 */
.block { margin: 16px; }
.section-title-row { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 10px; }
.section-title { font-size: 14px; font-weight: 600; }
.section-desc { font-size: 11px; color: var(--text-tertiary); }

/* 列表卡片 */
.list-card {
  background: white; border-radius: 12px;
  overflow: hidden; box-shadow: var(--shadow);
}
.list-item {
  display: flex; align-items: center;
  padding: 14px 16px; gap: 12px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer; transition: background 0.15s;
}
.list-item:last-child { border-bottom: none; }
.list-item:active { background: #f9fafb; }
.list-item.active { background: #f0fdf4; }

.item-emoji {
  width: 40px; height: 40px;
  background: var(--bg);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.item-info { flex: 1; min-width: 0; }
.item-name {
  font-size: 15px; font-weight: 500; color: var(--text-primary);
  display: flex; align-items: center; gap: 6px;
}
.item-cap { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.custom-tag {
  font-size: 10px; background: #fef3c7; color: #92400e;
  padding: 1px 6px; border-radius: 99px; font-weight: 500;
}

/* 右侧「默认」标签 */
.default-tag {
  font-size: 11px; font-weight: 600;
  background: var(--brand-light); color: var(--brand-dark);
  padding: 4px 10px; border-radius: 99px;
  flex-shrink: 0;
}

/* 添加按钮 */
.add-btn {
  margin-top: 12px;
  background: white; border-radius: 12px;
  padding: 14px 16px;
  display: flex; align-items: center; justify-content: center;
  gap: 6px; font-size: 14px; color: var(--brand);
  cursor: pointer; box-shadow: var(--shadow);
  transition: background 0.15s;
}
.add-btn:active { background: #ecfdf5; }

/* 提示 */
.block-hint {
  font-size: 11px; color: var(--text-tertiary);
  margin-top: 12px; text-align: center;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 0 16px;
}

/* 抽屉 */
.drawer {
  background: var(--bg);
  border-top-left-radius: 16px; border-top-right-radius: 16px;
  padding: 12px 12px calc(16px + env(safe-area-inset-bottom));
}
.drawer-header {
  background: white; border-radius: 12px;
  padding: 20px 16px; text-align: center;
  margin-bottom: 8px;
  position: relative;
}
.drawer-emoji { font-size: 48px; line-height: 1; }
.drawer-name { font-size: 17px; font-weight: 600; margin-top: 10px; }
.drawer-cap { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.drawer-default-tag {
  position: absolute; top: 14px; right: 14px;
  font-size: 11px; font-weight: 600;
  background: var(--brand-light); color: var(--brand-dark);
  padding: 3px 10px; border-radius: 99px;
}

.drawer-actions {
  background: white; border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}
.drawer-btn {
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  gap: 12px;
  padding: 16px;
  border: none; background: transparent;
  font-size: 15px; color: var(--text-primary);
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.15s;
}
.drawer-btn:last-child { border-bottom: none; }
.drawer-btn:active { background: #f9fafb; }
.drawer-btn.disabled { color: var(--brand); cursor: not-allowed; }
.drawer-btn-danger { color: #dc2626; }
.drawer-btn-danger:active { background: #fef2f2; }

.drawer-tip {
  padding: 12px 16px;
  font-size: 12px; color: var(--text-tertiary);
  display: flex; align-items: center; justify-content: center; gap: 4px;
}

.drawer-cancel {
  width: 100%;
  background: white; border: none; border-radius: 12px;
  padding: 16px;
  font-size: 15px; font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
}
.drawer-cancel:active { background: #f9fafb; }

/* 居中弹窗（添加/编辑表单） */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999; display: flex; align-items: center; justify-content: center; }
.form-modal { position: relative; width: 85%; max-width: 380px; background: white; border-radius: 18px; padding: 24px 20px 28px; }
.form-close { position: absolute; top: 12px; right: 14px; font-size: 18px; color: var(--text-tertiary); cursor: pointer; line-height: 1; }
.form-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 16px; }
.form-group { margin-bottom: 14px; }
.form-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.form-input { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 10px; font-size: 14px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.form-input:focus { border-color: var(--brand); }
.emoji-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.emoji-option { width: 40px; height: 40px; border-radius: 10px; border: 2px solid transparent; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; transition: all 0.15s; }
.emoji-option.selected { border-color: var(--brand); background: var(--brand-light); }
.form-submit { width: 100%; padding: 14px; background: var(--brand); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
.form-submit:active { opacity: 0.9; }
</style>