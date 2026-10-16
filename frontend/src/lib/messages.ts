import { API_BASE_URL } from '@/lib/env';
import { DEMO_SOURCE } from '@/lib/constants';
import type { StoresApiError } from '@/services/storesApi';

/**
 * All interface copy (Uzbek, Latin script) in one place, so adding another
 * language later means swapping this module rather than editing components.
 */
export const messages = {
  appName: 'Logistics Map',
  header: {
    statusConnecting: 'Ulanmoqda…',
    statusOnline: 'API ulangan',
    statusOffline: 'API bilan aloqa yo‘q',
    statusError: 'API xatolik qaytardi',
    demoBadge: 'Demo rejim',
    demoBadgeHint: 'Xaritada namoyish uchun yaratilgan demo ma’lumotlar ko‘rsatilmoqda.',
    lastUpdated: 'Yangilangan',
    refresh: 'Yangilash',
    refreshing: 'Yangilanmoqda…',
  },
  summary: {
    heading: 'Umumiy ko‘rsatkichlar',
    totalStores: 'Jami do‘konlar',
    visibleStores: 'Xaritada ko‘rinmoqda',
    selectedStore: 'Tanlangan do‘kon',
    noSelection: 'Tanlanmagan',
    city: 'Shahar',
    unavailable: 'Ma’lumot yo‘q',
  },
  search: {
    label: 'Do‘kon qidirish',
    placeholder: 'Do‘kon nomini yozing',
    clear: 'Qidiruvni tozalash',
  },
  list: {
    heading: 'Do‘konlar',
    loading: 'Do‘konlar yuklanmoqda…',
    emptyTitle: 'Hozircha do‘konlar yo‘q',
    emptyBody: 'Ma’lumotlar bazasiga do‘kon qo‘shilgach, u shu ro‘yxatda va xaritada ko‘rinadi.',
    noMatchBody: 'Nomni boshqacha yozib ko‘ring yoki qidiruvni tozalang.',
    errorTitle: 'Do‘konlar ro‘yxatini yuklab bo‘lmadi',
    retry: 'Qayta urinish',
    coordinates: 'Koordinatalar',
  },
  map: {
    regionLabel: 'Do‘konlar xaritasi',
    loading: 'Xarita yuklanmoqda…',
    storesLoading: 'Do‘konlar yuklanmoqda…',
    noStores: 'Xaritada ko‘rsatish uchun do‘kon yo‘q.',
    noMatch: 'Qidiruvga mos do‘kon topilmadi.',
    loadFailed: 'Do‘konlarni yuklab bo‘lmadi.',
    tilesFailed: 'Xarita tasviri yuklanmadi. Internet aloqasini tekshiring.',
    fitAll: 'Barcha do‘konlarni ko‘rsatish',
    resetView: 'Toshkent markaziga qaytish',
    zoomIn: 'Yaqinlashtirish',
    zoomOut: 'Uzoqlashtirish',
    closePopup: 'Yopish',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> hissadorlari',
  },
  store: {
    source: 'Manba',
    latitude: 'Kenglik',
    longitude: 'Uzunlik',
    copyCoordinates: 'Koordinatalarni nusxalash',
    copied: 'Nusxalandi',
    copyFailed: 'Nusxalab bo‘lmadi',
    openInOsm: 'OpenStreetMap’da ochish',
    clearSelection: 'Tanlovni bekor qilish',
    noSelectionHint: 'Do‘kon tanlanmagan. Ro‘yxatdan yoki xaritadan do‘kon tanlang.',
  },
  page: {
    errorTitle: 'Sahifani ko‘rsatishda xatolik yuz berdi',
    errorBody: 'Sahifani qayta yuklab ko‘ring. Muammo takrorlansa, administratorga xabar bering.',
    retry: 'Qayta urinish',
    notFoundTitle: 'Sahifa topilmadi',
    notFoundBody: 'Bu manzilda sahifa yo‘q.',
    goHome: 'Xaritaga qaytish',
  },
} as const;

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  [DEMO_SOURCE]: 'Demo ma’lumot',
};

/** Human-readable name of a data source; unknown sources are shown as stored. */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function storeCountLabel(total: number): string {
  return `Jami ${total} ta do‘kon`;
}

export function matchCountLabel(matched: number, total: number): string {
  return matched === 0
    ? `${total} ta do‘kondan hech biri mos kelmadi`
    : `${total} ta do‘kondan ${matched} tasi mos keldi`;
}

export function noMatchTitle(query: string): string {
  return `“${query.trim()}” bo‘yicha do‘kon topilmadi`;
}

export function skippedRecordsLabel(count: number): string {
  return `${count} ta yozuv noto‘g‘ri ma’lumot sababli ko‘rsatilmadi.`;
}

export function staleDataLabel(time: string): string {
  return `Yangilab bo‘lmadi. Ekranda soat ${time} dagi ma’lumot ko‘rsatilmoqda.`;
}

/** Explains a failed store request and, where possible, what to do about it. */
export function describeStoresError(error: StoresApiError): string {
  switch (error.kind) {
    case 'network':
      return `Serverga ulanib bo‘lmadi. Backend ishga tushganini va ${API_BASE_URL} manzili to‘g‘ri ekanini tekshiring.`;
    case 'timeout':
      return 'Server belgilangan vaqtda javob bermadi. Birozdan so‘ng qayta urinib ko‘ring.';
    case 'http':
      if (error.status === 429) {
        return 'So‘rovlar soni chegaradan oshdi. Birozdan so‘ng qayta urinib ko‘ring.';
      }
      if (error.status === 503) {
        return 'Ma’lumotlar bazasi vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.';
      }
      return `Server xatolik qaytardi (kod: ${error.status ?? 'noma’lum'}).`;
    case 'invalid_response':
      return 'Serverdan kutilmagan formatdagi javob keldi. Backend versiyasini tekshiring.';
  }
}
