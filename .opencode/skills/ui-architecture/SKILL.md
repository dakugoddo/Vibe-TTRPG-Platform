---
name: ui-architecture
description: Дизайн-система Glassmorphism, стандарты контекстных меню, Z-Index иерархия, структура UI компонентов
---

## Глобальная тема
- `app/src/utils/theme.ts` — константы glassDark/glassLight, самый важный файл для смены стиля
- `app/src/App.tsx` — монтирует div с theme.glass.bg (фиолетово-синий градиент)

## Z-Index иерархия (строго!)
1. Активный Канвас (z:0)
2. Элементы Канваса (z:10)
3. Активный UI Канваса (z:20)
4. Кнопки боковых панелей (z:30)
5. Боковые панели Drawers (z:40)
6. Незакрепленные окна (z:50)
7. Всплывашки Tooltips/Popovers (z:9999) — React Portal в body

## Стандарт контекстных меню (обязателен для ВСЕХ меню)
- Контейнер: `fixed rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 py-1.5 min-w-[200px] overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100 bg-[#151c2b]/70`
- Заголовок: `px-3 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 select-none pointer-events-none`
- Кнопки: `w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group`
- Иконки: Lucide size=14, text-white/40 → group-hover:text-white/80
- Опасные: text-red-400 hover:bg-red-500/20, иконка text-red-500/50
- Монтирование: z-[99999], поверх защитного слоя z-[99998]
- Анимации: БЕЗ animate-in у FloatingPortal, мгновенное появление

## Ключевые файлы
- `theme.ts` — глобальная тема
- `LeftDrawer.tsx` / `RightDrawer.tsx` — боковые панели
- `EntityWindow.tsx` — рама окна (react-rnd)
- `EntityDatabase.tsx` — список сущностей + контекстное меню
- `ChatPanel.tsx` — чат и дайсы
- `CharacterSheet.tsx` — лист персонажа (табы: STATS, INVENTORY, NOTES)
- `blocks/AttributeBlock.tsx` — статы, HP бары, Power toggle
- `blocks/InventoryBlock.tsx` — инвентарь, надеть/снять тоглы

## Всплывашки
Стандарт контейнера: `bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]`
НЕ должны быть глухими чёрными пятнами.

## При смене дизайна
1. Начни с theme.ts — 80% приложения обновится
2. Остальные 20% — локальные хардкоды в EntityDatabase.tsx, AttributeBlock.tsx
