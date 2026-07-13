-- Meals become user-defined rows instead of a four-value enum.
--
-- Written by hand rather than generated, because the generated version drops FoodEntry.meal
-- and every logged meal goes with it. This one carries the data across: each user gets the
-- four slots seeded, and every existing entry is re-pointed at the slot matching its old enum.

CREATE TABLE "MealSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealSlot_userId_name_key" ON "MealSlot"("userId", "name");
CREATE INDEX "MealSlot_userId_order_idx" ON "MealSlot"("userId", "order");

ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the four defaults for every existing user. gen_random_uuid() rather than cuid because
-- this runs in SQL; the ids only have to be unique, not match Prisma's format.
INSERT INTO "MealSlot" ("id", "userId", "name", "order")
SELECT gen_random_uuid()::text, u."id", m."name", m."order"
FROM "User" u
CROSS JOIN (VALUES ('Breakfast', 0), ('Lunch', 1), ('Snacks', 2), ('Dinner', 3))
    AS m("name", "order");

-- Nullable first, so existing rows survive long enough to be back-filled.
ALTER TABLE "FoodEntry" ADD COLUMN "mealId" TEXT;

UPDATE "FoodEntry" e
SET "mealId" = s."id"
FROM "MealSlot" s
WHERE s."userId" = e."userId"
  AND s."name" = CASE e."meal"::text
      WHEN 'BREAKFAST' THEN 'Breakfast'
      WHEN 'LUNCH'     THEN 'Lunch'
      WHEN 'SNACK'     THEN 'Snacks'
      WHEN 'DINNER'    THEN 'Dinner'
  END;

-- If any row failed to map, this fails loudly rather than quietly discarding someone's food.
ALTER TABLE "FoodEntry" ALTER COLUMN "mealId" SET NOT NULL;

-- Restrict, not Cascade: deleting a meal slot must never silently delete the food eaten in it.
ALTER TABLE "FoodEntry" ADD CONSTRAINT "FoodEntry_mealId_fkey"
    FOREIGN KEY ("mealId") REFERENCES "MealSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FoodEntry" DROP COLUMN "meal";
DROP TYPE "MealType";
