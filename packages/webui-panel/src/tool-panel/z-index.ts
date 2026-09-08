import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useZIndexStore = defineStore("z-index", () => {
    const zIndex = ref(0)

    function tapZIndex() {
        return ++zIndex.value
    }

    return { zIndex, tapZIndex }
})