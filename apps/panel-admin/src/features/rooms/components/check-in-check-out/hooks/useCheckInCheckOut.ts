import { useEffect, useState } from "react";
import {
  CHECK_IN_TIME_SLOTS,
  CHECK_OUT_TIME_SLOTS,
} from "@/features/rooms/constants/checkInCheckOut.constants";
import {
  getRoomSchedulesAction,
  saveRoomSchedulesAction,
} from "@/features/rooms/services/scheduleActions";
import { useI18n } from "@/locales";

export const useCheckInCheckOut = (roomId: string, onSuccess?: () => void) => {
  const { t } = useI18n();
  const texts = t.ROOMS;

  const [selectedCheckIn, setSelectedCheckIn] = useState<string[]>([]);
  const [selectedCheckOut, setSelectedCheckOut] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const { data: schedules, error: loadError } = await getRoomSchedulesAction(roomId);
        if (loadError) throw new Error(loadError);

        const checkIns = schedules
          .filter((s) => s.schedule_type === "check_in")
          .map((s) => s.time_slot.substring(0, 5)); // ensure "HH:MM" format
        const checkOuts = schedules
          .filter((s) => s.schedule_type === "check_out")
          .map((s) => s.time_slot.substring(0, 5));

        setSelectedCheckIn(checkIns);
        setSelectedCheckOut(checkOuts);
      } catch (err) {
        console.error("Failed to load schedules", err);
        setError(texts.SCHEDULES.ERROR_LOAD);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [roomId, texts.SCHEDULES.ERROR_LOAD]);

  const handleSubmit = async () => {
    if (selectedCheckIn.length === 0 && selectedCheckOut.length === 0) {
      setError(texts.SCHEDULES.EMPTY_SELECTION);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const { error: saveError } = await saveRoomSchedulesAction(roomId, {
        checkIn: selectedCheckIn,
        checkOut: selectedCheckOut,
      });
      if (saveError) throw new Error(saveError);
      onSuccess?.();
    } catch (err) {
      console.error("Failed to save schedules", err);
      setError(texts.SCHEDULES.ERROR_SAVE);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedCheckIn,
    setSelectedCheckIn,
    selectedCheckOut,
    setSelectedCheckOut,
    isLoading,
    isSubmitting,
    error,
    setError,
    texts,
    handleSubmit,
    checkInOptions: CHECK_IN_TIME_SLOTS,
    checkOutOptions: CHECK_OUT_TIME_SLOTS,
  };
};
