import { createSelector } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { Dataset } from "~/types/api";

interface HealthResponse {
  core_fidesctl_version: string;
  status: "healthy";
}

/**
 * These interfaces will be replaced with the OpenAPI generated models when the backend is ready.
 */
interface ClassificationRequest {
  // Key of the dataset. Should this have "dataset_" prefix?
  fides_key: string;
}
interface ClassificationResponse {
  // Classifications probably have a UID not a key
  id: string;
  // Dataset key
  fides_key: string;
  // Probably will become an enum.
  status: "processing" | "review" | "classified";
  // Assuming it's just the fields generated by classify. What's a good name?
  // (This is blank while in the "processing" status.
  classification?: Pick<Dataset, "data_categories" | "collections">;
}

export const plusApi = createApi({
  reducerPath: "plusApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_FIDESCTL_API}/plus`,
  }),
  tagTypes: ["Plus"],
  endpoints: (build) => ({
    getHealth: build.query<HealthResponse, void>({
      query: () => "health",
    }),
    /**
     * Fidescls endpoints:
     */
    createClassification: build.mutation<
      ClassificationResponse,
      ClassificationRequest
    >({
      query: (body) => ({
        // Or is this "classify/"?
        url: `classification/`,
        method: "POST",
        body,
      }),
    }),
    getAllClassifications: build.query<ClassificationResponse[], void>({
      query: () => `classification/`,
    }),
  }),
});

export const {
  useGetHealthQuery,
  useCreateClassificationMutation,
  useGetAllClassificationsQuery,
} = plusApi;

export const useHasPlus = () => {
  const { isSuccess: hasPlus } = useGetHealthQuery();
  return hasPlus;
};

const emptyClassifications: ClassificationResponse[] = [];
const selectClassificationsMap = createSelector(
  ({ data }: { data?: ClassificationResponse[] }) =>
    data ?? emptyClassifications,
  (dataCategories) => ({
    map: new Map(dataCategories.map((c) => [c.fides_key, c])),
  })
);

/**
 * Convenience hook for looking up a Classification by Dataset key.
 */
export const useClassificationsMap = (): Map<
  string,
  ClassificationResponse
> => {
  const hasPlus = useHasPlus();
  const { map } = useGetAllClassificationsQuery(undefined, {
    skip: !hasPlus,
    selectFromResult: selectClassificationsMap,
  });
  return map;
};