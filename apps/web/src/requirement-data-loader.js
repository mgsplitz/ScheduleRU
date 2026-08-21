(function exposeRequirementDataLoader(root) {
  const DEFAULT_SELECTION_POLICIES = { limits: [], combination_policies: [] };
  const uniqueIds = (values) => [...new Set(
    (Array.isArray(values) ? values : [])
      .filter((value) => typeof value === "string" && value),
  )];
  const encodedIds = (ids) => ids.map(encodeURIComponent).join(",");
  const array = (value) => (Array.isArray(value) ? value : []);
  const object = (value) => (
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  );

  function create({ request }) {
    if (typeof request !== "function") throw new TypeError("request must be a function");

    async function loadSchools() {
      const data = await request("/api/schools");
      const schools = array(data?.schools).filter(
        (school) => school && typeof school.slug === "string" && school.slug,
      );
      if (!schools.length) {
        throw new Error("Rutgers school profiles could not be loaded.");
      }
      return schools;
    }

    async function loadPrograms({ homeSchoolSlug, scope = "all" }) {
      const school = encodeURIComponent(homeSchoolSlug || "");
      const programPath = scope === "school"
        ? `/api/programs?school=${school}`
        : "/api/programs";
      const [programData, policyData] = await Promise.all([
        request(programPath),
        request(`/api/program-selection-policies?home_school=${school}`),
      ]);
      return {
        programs: array(programData?.programs),
        selectionPolicies: policyData || DEFAULT_SELECTION_POLICIES,
      };
    }

    async function loadRequirements({ programIds, homeSchoolSlug }) {
      const ids = uniqueIds(programIds);
      const school = encodeURIComponent(homeSchoolSlug || "");
      const [data, policyData] = await Promise.all([
        ids.length
          ? request(`/api/requirements?programs=${encodedIds(ids)}`)
          : Promise.resolve({ requirements: {} }),
        request(`/api/double-count-policies?school=${school}`),
      ]);
      return {
        programIds: ids,
        requirements: object(data?.requirements),
        catalogListedProgramIds: array(data?.catalog_listed_program_ids),
        doubleCountPolicies: array(policyData?.policies),
        doubleCountRules: array(data?.double_count_rules),
        doubleCountExceptions: array(data?.double_count_exceptions),
        eligibilityRules: array(data?.eligibility_rules),
      };
    }

    async function loadReferenceRequirements({ programIds }) {
      const ids = uniqueIds(programIds);
      if (ids.length < 2) return {};
      const data = await request(`/api/requirements?programs=${encodedIds(ids)}`);
      return object(data?.requirements);
    }

    async function loadCoreCurriculum({ homeSchoolSlug, label = "Core Curriculum" }) {
      const school = encodeURIComponent(homeSchoolSlug || "");
      const data = await request(`/api/core-curricula?school=${school}`);
      const curricula = array(data?.curricula);
      const curriculum = curricula[0];
      if (!curriculum?.id) throw new Error(`${label} could not be loaded.`);
      const detail = await request(`/api/programs/${encodeURIComponent(curriculum.id)}/requirements`);
      return {
        curricula,
        curriculum,
        requirements: array(detail?.requirements),
      };
    }

    return {
      loadSchools,
      loadPrograms,
      loadRequirements,
      loadReferenceRequirements,
      loadCoreCurriculum,
    };
  }

  root.ScheduleRURequirementDataLoader = { create };
})(globalThis);
