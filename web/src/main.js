import { createApp } from 'vue';
import { createPinia } from 'pinia';
import {
  Lazyload,
  Tab,
  Tabs,
  Field,
  CellGroup,
  Button,
  Cell,
  Icon,
  Popup,
  Picker,
  TimePicker,
  Switch,
  Slider,
  NavBar,
  Tabbar,
  TabbarItem,
  Toast,
  Dialog,
  Form,
  Notify,
} from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import router from './router';
import './assets/styles.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
[
  Lazyload, Tab, Tabs, Field, CellGroup, Button, Cell, Icon,
  Popup, Picker, TimePicker, Switch, Slider, NavBar,
  Tabbar, TabbarItem, Toast, Dialog, Form, Notify,
].forEach((c) => app.use(c));
app.mount('#app');