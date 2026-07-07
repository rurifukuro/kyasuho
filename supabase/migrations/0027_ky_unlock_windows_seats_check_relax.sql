-- seats列はRev55で不使用化（席数はky_seat_types.capacityに移行）。
-- アプリがseats:0を送るのでCHECKを >= 0 に緩和。
ALTER TABLE ky_unlock_windows DROP CONSTRAINT ky_unlock_windows_seats_check;
ALTER TABLE ky_unlock_windows ADD CONSTRAINT ky_unlock_windows_seats_check CHECK (seats >= 0);
