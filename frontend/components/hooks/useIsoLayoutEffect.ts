import { useEffect, useLayoutEffect } from "react";

export const useIsoLayoutEffect =
    typeof document !== "undefined" ? useLayoutEffect : useEffect;
