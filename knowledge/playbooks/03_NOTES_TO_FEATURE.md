# Playbook 03 - Convert Notes to a Feature Card

## Inputs
- Relevant chunk IDs.
- A concise product objective.

## Procedure
1. Cluster chunks by recurring idea, system, or dependency.
2. Separate facts, speculative ideas, code fragments, and prompt experiments.
3. Create a feature ID and neutral product name.
4. Define the module boundary and public interface.
5. Add acceptance criteria and tests.
6. Add source filenames/chunk IDs.
7. Flag harmful operational content as a non-executable reference.
8. Add the feature to `knowledge/features/feature-catalog.json`.

## Required fields
`id`, `name`, `priority`, `module`, `description`, `source_basis`, `acceptance_criteria`.
