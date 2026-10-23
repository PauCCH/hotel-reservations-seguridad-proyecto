import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Amenity } from "@/features/rooms/domain/amenity.interface";
import {
  getRoomAmenitiesFormDataAction,
  saveRoomAmenitiesAction,
} from "@/features/rooms/services/amenityActions";
import { useI18n } from "@/locales";
import type { AmenitiesFormValues } from "../AmenitiesForm.interface";
import { AMENITIES_FORM_CONSTANTS } from "../constants/amenitiesForm.constants";
import { useCustomAmenities } from "./useCustomAmenities";

const { FORM_FIELD, LOG_MESSAGES } = AMENITIES_FORM_CONSTANTS;

export const useAmenitiesForm = (roomId: string, onSuccess?: () => void) => {
  const { t } = useI18n();
  const texts = t.ROOMS;

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<AmenitiesFormValues>({
    defaultValues: { [FORM_FIELD]: [] },
  });

  const selectedIds = watch(FORM_FIELD);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await getRoomAmenitiesFormDataAction(roomId);
        if (error || !data) throw new Error(error ?? "No data");
        setAmenities(data.predefined);
        setValue(FORM_FIELD, data.roomSelected);
      } catch (error) {
        console.error(LOG_MESSAGES.LOAD_ERROR, error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [roomId, setValue]);

  const toggleAmenity = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setValue(FORM_FIELD, next, { shouldValidate: true });
  };

  const { isAddingCustom, handleAddCustom, handleUpdateCustom, handleDeleteCustom } =
    useCustomAmenities(amenities, setAmenities, selectedIds, setValue);

  const onSubmit = async (data: AmenitiesFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await saveRoomAmenitiesAction(roomId, data.amenityIds);
      if (error) throw new Error(error);
      onSuccess?.();
    } catch (error) {
      console.error(LOG_MESSAGES.SAVE_ERROR, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const localizedAmenities = amenities.map((a) => {
    const trans = texts.AMENITIES.ITEMS[a.id];
    return {
      ...a,
      name: trans?.name ?? a.name,
      description: trans?.description ?? a.description,
    };
  });

  const filteredAmenities = localizedAmenities.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return {
    amenities: filteredAmenities,
    selectedIds,
    isLoading,
    isSubmitting,
    isAddingCustom,
    errors,
    texts,
    searchTerm,
    setSearchTerm,
    toggleAmenity,
    handleAddCustom,
    handleUpdateCustom,
    handleDeleteCustom,
    handleSubmit: handleSubmit(onSubmit),
  };
};
